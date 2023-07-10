/*
 * ファイル名: cognito.js
 * 作成日: 2023/07/10
 * 作成者: xunjin.chen
 * 作成内容: 新規作成
 * ver:1.0.0
 */
const moment = require('moment-timezone')
const cognitoExpress = require('cognito-express')
const AmazonCognitoIdentity = require('amazon-cognito-identity-js')
const AWS = require('aws-sdk')
AWS.config.update({
  region: process.env['REGION']
})
const TOKEN_TYPE_ID = 'id'

// サインアウトしたトークンのハッシュセット。日付別に無効化トークンを持つ。
var invalidTokensByDay = {};

module.exports = class Cognito {
  constructor(tokenUse = TOKEN_TYPE_ID) {
    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      ClientId: process.env['APP_CLIENT_ID']
    }
    this.userPool = new AmazonCognitoIdentity.CognitoUserPool(params)

    this.cognitoExpress = new cognitoExpress({
      region: process.env['REGION'],
      cognitoUserPoolId: params['UserPoolId'],
      tokenUse: tokenUse,
      tokenExpiration: 3600000 //1 hour (3600000 ms)
    })
  }

  verifyToken(token) {
    const that = this

    // 無効化トークンリストに含まれていないかチェック
    const day = moment().tz("Asia/Tokyo").format('YYYYMMDD')
    if (invalidTokensByDay.hasOwnProperty(day) && invalidTokensByDay[day].hasOwnProperty(token)) {
      throw { 'name': 'InvalidTokenUse', 'message': 'Token not Found' };
    }

    return new Promise(function (resolve, reject) {
      that.cognitoExpress.validate(token, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }

  signUp(id, pass) {
    return new Promise((resolve, reject) => {
      this.userPool.signUp(id, pass, [], null, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }

  signOut(id) {
    return new Promise((resolve, reject) => {
      this.userPool.signOut(id, pass, [], null, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }

  confirmRegistration(id, code) {
    return new Promise((resolve, reject) => {
      const userData = {
        Username: id,
        Pool: this.userPool,
      }
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData)
      cognitoUser.confirmRegistration(code, true, (err, res) => {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }

  authenticateUser(id, pass) {
    return new Promise((resolve, reject) => {
      const userData = {
        Username: id,
        Pool: this.userPool,
      }
      const authenticationData = {
        Username: id,
        Password: pass,
      }
      let response = 'success'
      const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData)
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData)
      const authCallbacks = {
        response: response,
        onSuccess: function (result) {
          result['result'] = response
          return resolve(result)
        },
        onFailure: function (err) {
          return reject(err)
        },
        newPasswordRequired(userAttributes, requiredAttributes) { // eslint-disable-line no-unused-vars
          // https://stackoverflow.com/questions/51103676/aws-cognito-react-js-newpasswordrequired-challenge
          // パスワード更新
          return reject({ code: 'NotAuthorizedException', name: 'NewPasswordRequiredException', message: 'New password required' })
        }
      }
      cognitoUser.authenticateUser(authenticationDetails, authCallbacks)
    })
  }

  changePassword(id, oldPass, newPass) {
    return new Promise((resolve, reject) => {
      const userData = {
        Username: id,
        Pool: this.userPool,
      }
      const authenticationData = {
        Username: id,
        Password: oldPass
      }
      const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData)
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData)
      const authCallbacks = {
        onSuccess: function (result) {
          return cognitoUser.changePassword(oldPass, newPass, (err, result2) => { // eslint-disable-line no-unused-vars
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          })
        },
        onFailure: function (err) {
          return reject(err)
        },
        newPasswordRequired(userAttributes, requiredAttributes) { // eslint-disable-line no-unused-vars
          return cognitoUser.completeNewPasswordChallenge(newPass, {}, {
            onSuccess: function (result) {
              resolve(result)
            },
            onFailure: function (err) {
              reject(err)
            }
          })
        }
      }
      cognitoUser.authenticateUser(authenticationDetails, authCallbacks)
    })
  }

  /**
   * 確認済みの携帯電話またはEメールに認証コードを送信する
   * @param {string} id アカウント名
   * @returns 実行結果
   */
  forgotPassword(id) {
    return new Promise((resolve, reject) => {
      const userData = {
        Username: id,
        Pool: this.userPool,
      }
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData)
      cognitoUser.forgotPassword({
        onSuccess: function (result) {
          resolve(result)
        },
        onFailure: function (err) {
          reject({ name: 'UserNotFoundError', message: err.message })
        }
      })
    })
  }

  /**
   * 確認コードと新パスワードを入力し、忘れたパスワードをリセットする
   * @param {string} id アカウント名
   * @param {string} verificationCode 認証コード（6桁）
   * @param {string} newPassword 新パスワード
   * @returns 実行結果
   */
  confirmPassword(id, verificationCode, newPassword) {
    return new Promise((resolve, reject) => {
      const userData = {
        Username: id,
        Pool: this.userPool,
      }
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData)
      cognitoUser.confirmPassword(verificationCode, newPassword, {
        onSuccess: function (result) {
          resolve(result)
        },
        onFailure: function (err) {
          reject({ name: 'BadVerificationCodeError', message: err.message })
        }
      })
    })
  }

  refreshToken(refreshToken) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })
    const adminInitiateAuthResult = cognito.adminInitiateAuth({
      UserPoolId: process.env['USER_POOL_ID'],
      ClientId: process.env['APP_CLIENT_ID'],
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    }).promise()
    return adminInitiateAuthResult
  }

  /**
   * ユーザ情報を取得する
   * @param {string} id アカウント名
   * @returns 実行結果
   */
  getUserAttributes(id) {
    return new Promise((resolve, reject) => {
      const cognito = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18'
      })
      cognito.adminGetUser({
        UserPoolId: process.env['USER_POOL_ID'],
        Username: id,
      }, (err, res) => {
        if (err) return reject({ code: err.code, name: 'UserNotFoundError', message: err.message })
        resolve(res)
      })
    })
  }

  /**
   * ユーザ情報を更新する
   * @param {string} id アカウント名
   * @param {AttributeListType} userAttributes ユーザーの属性を表す名前と値のペアの配列
   * @returns 実行結果
   */
  updateUserAttributes(id, userAttributes) {
    return new Promise((resolve, reject) => {
      const cognito = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18'
      })
      cognito.adminUpdateUserAttributes({
        UserPoolId: process.env['USER_POOL_ID'],
        Username: id,
        UserAttributes: userAttributes
      }, (err, res) => {
        if (err) return reject({ code: err.code, name: 'UserNotFoundError', message: err.message })
        resolve(res)
      })
    })
  }

  /**
   * 携帯電話またはEメールに送信した認証コードを検証する
   * @param {string} attributeName ユーザーの属性名
   * @param {string} confirmationCode 認証コード
   * @param {string} accessToken アクセストークン
   * @returns 実行結果
   */
  verifyUserAttribute(attributeName, confirmationCode, accessToken) {
    return new Promise((resolve, reject) => {
      const cognito = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18'
      })
      cognito.verifyUserAttribute({
        AttributeName: attributeName,
        Code: confirmationCode,
        AccessToken: accessToken,
      }, (err, res) => {
        if (err) return reject({ code: err.code, name: 'BadVerificationCodeError', message: err.message })
        resolve(res)
      })
    })
  }
  /**
   * Cognitoにユーザーを登録する
   * @param {string} userId ユーザーID
   * @param {string} pass パスワード
   * @returns 実行結果
   */
  registUser(userId, pass) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })

    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      DesiredDeliveryMediums: ['SMS'],
      ForceAliasCreation: false,
      MessageAction: 'SUPPRESS',
      Username: userId,
      TemporaryPassword: pass
    }

    const response = cognito.adminCreateUser(params).promise()
    return response
  }

  /**
   * Cognitoにユーザーを登録する
   * @param {string} userId ユーザーID
   * @param {string} groupName ユーザーの属性名
   * @returns 実行結果
   */
  addUserToGroup(userId, groupName) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })
    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      GroupName: groupName,
      Username: userId,
    }
    const response = cognito.adminAddUserToGroup(params).promise()
    return response
  }

  /**
   * Cognitoにユーザーを削除する
   * @param {string} userId ユーザーID
   * @returns 実行結果
   */
  deleteUser(userId) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })
    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      Username: userId
    }
    const response = cognito.adminDeleteUser(params).promise()
    return response
  }

  /**
   * Cognitoのユーザーを有効化・無効化する
   * @param {string} userId ユーザーID
   * @param {boolean} enableFlg 有効フラグ
   * @returns 実行結果
   */
  setEnableUser(userId, enableFlg) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })
    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      Username: userId
    }

    if (enableFlg) {
      return cognito.adminEnableUser(params).promise()
    }
    else {
      return cognito.adminDisableUser(params).promise()
    }
  }

  /**
   * Cognitoにユーザーのパスワードを再設定する
   * @param {string} userId ユーザーID
   * @param {string} pass パスワード
   * @returns 実行結果
   */
  adminSetUserPassword(userId, pass) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })

    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      Username: userId,
      Password: pass
    }

    const response = cognito.adminSetUserPassword(params).promise()
    return response
  }

  /**
   * ユーザーが属するグループを取得
   * @param {string} userId ユーザーID
   * @returns 実行結果
   */
  async adminListGroupsForUser(userId) {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })
    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      Username: userId,
    }
    const data = await cognito.adminListGroupsForUser(params).promise()
    return data.Groups
  }

  /**
   * ユーザ属性を削除する
   * @param {string} id アカウント名
   * @param {AttributeListType} userAttributes ユーザーの属性を表す名前と値のペアの配列
   * @returns 実行結果
   */
  deleteUserAttributes(id, userAttributes) {
    return new Promise((resolve, reject) => {
      const cognito = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18'
      })
      cognito.adminDeleteUserAttributes({
        UserPoolId: process.env['USER_POOL_ID'],
        Username: id,
        UserAttributeNames: userAttributes
      }, (err, res) => {
        if (err) return reject({ code: err.code, name: 'UserNotFoundError', message: err.message })
        resolve(res)
      })
    })
  }

  /**
   * ドメイン名を取得する
   * @returns {String}
   */
  async getClientDomain() {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })
    const params = {
      UserPoolId: process.env['USER_POOL_ID']
    }
    const data = await cognito.describeUserPool(params).promise()
    return 'https://' + data.UserPool.Domain + '.auth.' + process.env['REGION'] + '.amazoncognito.com'
  }

  /**
   * CallbackURLsを取得する
   * @returns {Array}
   */
  async getCallbackURLs() {
    const cognito = new AWS.CognitoIdentityServiceProvider({
      apiVersion: '2016-04-18'
    })
    const params = {
      UserPoolId: process.env['USER_POOL_ID'],
      ClientId: process.env['APP_CLIENT_ID']
    }
    const data = await cognito.describeUserPoolClient(params).promise()
    return data.UserPoolClient.CallbackURLs
  }
}