/*
 * ファイル名: ses.js
 * 作成日: 2022/10/28
 * 作成者: xunjin.chen
 * 作成内容: 新規作成
 * ver:1.0.0
 */
const AWS = require('aws-sdk')
var libmime = require('libmime')
AWS.config.update({ region: 'ap-northeast-1' })
const ses = new AWS.SES({ apiVersion: '2010-12-01' })

module.exports = class ServiceSES {
  /**
   * メールの送信
   * @param {Array<String>} toAddresses 受信先のアドレスリスト
   * @param {string} messageBody メール本文の内容
   * @param {string} title メールタイトルの内容
   * @param {string} from メール送信元
   * @returns 実行結果
   */
  static async sendEmail(toAddresses, messageBody, title, from) {
    // 送信者名 MIMEエンコード
    const fromName = libmime.encodeWord('サンプルメール', 'Q')
    const params = {
      Destination: {
        ToAddresses: toAddresses
      },
      Message: {
        Body: {
          Html: {
            Data: messageBody,
            Charset: 'utf-8'
          }
        },
        Subject: {
          Data: title,
          Charset: 'utf-8'
        }
      },
      // From
      Source: fromName + '<' + from + '>'
    }
    return new Promise(function (resolve, reject) {
      ses.sendEmail(params, function (err, data) {
        if (err) {
          reject(err)
        } if (data) {
          resolve(data)
        }
      })
    })
  }

  /**
   * メールアドレスの登録
   * @param {string}} mail メールアドレス
   * @returns 実行結果
   */
  static async verifyMail(mail) {
    const params = {
      EmailAddress: mail
    }
    return new Promise(function (resolve, reject) {
      ses.verifyEmailIdentity(params, function (err, data) {
        if (err) {
          reject(err)
        } if (data) {
          resolve(data)
        }
      })
    })
  }

  /**
   * identityの削除
   * @param {string}} identity 削除対象
   * @returns 実行結果
   */
  static async deleteIdentity(identity) {
    const params = {
      Identity: identity
    }
    return new Promise(function (resolve, reject) {
      ses.deleteIdentity(params, function (err, data) {
        if (err) {
          reject(err)
        } if (data) {
          resolve(data)
        }
      })
    })
  }
}
