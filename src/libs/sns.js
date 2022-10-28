/*
 * ファイル名: sns.js
 * 作成日: 2022/10/27
 * 作成者: xunjin.chen
 * 作成内容: 新規作成
 * ver:1.0.0
 */
const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-northeast-1' })
const sns = new AWS.SNS()
const sts = new AWS.STS()
const platformName = "example"

module.exports = class ServiceSNS {
  /**
   * エンドポイントの作成
   * @param {string}} token デバイストークン
   * @returns 実行結果
   */
  static async createSnsEndpoint(token) {
    const accountId = (await sts.getCallerIdentity({}).promise()).Account;
    // プラットフォームアプリケーションのARN値
    const snsPlatformApplicationArn = `arn:aws:sns:ap-northeast-1:${accountId}:app/GCM/${platformName}`
    const params = {
      PlatformApplicationArn: snsPlatformApplicationArn,
      Token: token
    }
    return new Promise(function (resolve, reject) {
      sns.createPlatformEndpoint(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * エンドポイントの有効化
   * @param {string} endpointArn エンドポイントARN
   * @returns 実行結果
   */
  static async enableSnsEndpoint(endpointArn) {
    const params = {
      Attributes: {
        Enabled: 'true'
      },
      EndpointArn: endpointArn
    }
    return new Promise(function (resolve, reject) {
      sns.setEndpointAttributes(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * エンドポイントの削除
   * @param {string}} endpointArn 
   * @returns 
   */
  static async deleteSnsEndpoint(endpointArn) {
    const params = {
      EndpointArn: endpointArn
    }
    return new Promise(function (resolve, reject) {
      sns.deleteEndpoint(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * サブスクリプションの作成
   * @param {string} topicArn トピックARN
   * @param {string} endpointArn エンドポイントARN
   * @returns 実行結果
   */
  static async createSnsSubscription(topicArn, endpointArn) {
    const params = {
      // プッシュ通知の場合は'application'
      // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SNS.html
      Protocol: 'application',
      TopicArn: topicArn,
      Endpoint: endpointArn
    }
    return new Promise(function (resolve, reject) {
      sns.subscribe(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * サブスクリプションの削除
   * @param {string} subscriptionArn サブスクリプションARN
   * @returns 実行結果
   */
  static async unsubscribe(subscriptionArn) {
    const params = {
      SubscriptionArn: subscriptionArn
    }
    return new Promise(function (resolve, reject) {
      sns.unsubscribe(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * トピックの作成
   * @param {string} topicId トピックID
   * @returns 実行結果
   */
  static async createSnsTopic(topicId) {
    const params = {
      Name: topicId
    }
    return new Promise(function (resolve, reject) {
      sns.createTopic(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * トピックの削除
   * @param {string} topicArn トピックArn
   * @returns 実行結果
   */
  static async deleteSnsTopic(topicArn) {
    const params = {
      TopicArn: topicArn
    }
    return new Promise(function (resolve, reject) {
      sns.deleteTopic(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * 暗号化したトピックの作成
   * @param {string} topicId トピックID
   * @returns 実行結果
   */
  static async createSnsTopicWithKMS(topicId) {
    const accountId = (await sts.getCallerIdentity({}).promise()).Account;
    const params = {
      Name: topicId,
      Attributes: {
        'KmsMasterKeyId': `arn:aws:kms:ap-northeast-1:${accountId}:alias/SNS-Key`,
        /* '<attributeName>': ... */
      },
    }
    return new Promise(function (resolve, reject) {
      sns.createTopic(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }

  /**
   * エンドポイントへのメッセージ送信
   *  ダイレクトメッセージなど直接送信する必要が出てきた場合に利用する。
   * @param {string} endpointArn エンドポイントARN
   * @param {string} title 標題
   * @param {string} message メッセージ
   * @param {string} groupId グループID
   * @param {int} badge 未読メッセージ数
   * @returns 実行結果
   */
  static async sendsns(endpointArn, title, message, groupId, badge) {
    var payload = {
      GCM: {
        content_available: true,
        data: {
          groupId: groupId,
          badge: badge
        },
        notification: {
          body: message,
          title: title,
          badge: badge.toString()
        }
      }
    }
    payload.GCM = JSON.stringify(payload.GCM);
    payload = JSON.stringify(payload);
    const params = {
      TargetArn: endpointArn,
      MessageStructure: 'json',
      Subject: title,
      Message: payload,
    }
    return new Promise(function (resolve, reject) {
      sns.publish(params, function (err, data) {
        if (err) reject(err)
        if (data) resolve(data)
      })
    })
  }
}
