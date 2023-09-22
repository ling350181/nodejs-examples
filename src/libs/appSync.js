/*
 * ファイル名: appSync.js
 * 作成日: 2023/09/22
 * 作成者: xunjin.chen
 * 作成内容: 新規作成
 * ver:1.0.0
 */
const AWSAppSyncClient = require('aws-appsync').default
const AWS = require('aws-sdk')
const SCAN_LIMIT_COUNT = 100

AWS.config.update({
  region: process.env['REGION'],
})

module.exports = class AppSync {
  constructor() {
    const appsyncOpts = {
      auth: {
        type: 'AWS_IAM',
        credentials: () => AWS.config.credentials
      },
      disableOffline: true,
      region: process.env['REGION'],
      url: process.env['API_HEALTHCAREGRAPHQL_GRAPHQLAPIENDPOINTOUTPUT'],
    }
    this.appSyncClient = new AWSAppSyncClient(appsyncOpts)
  }

  /**
   * scan取得
   * @param {object} queryParam クエリパラメータ（クエリ文字列とクエリ引数）
   * @param {int} pageLimit ページングの取得件数（設定しない場合は、デフォルトの件数を使用する）
   * @returns 実行結果
   */
  async scan(queryParam, pageLimit) {

    let allItems = []
    let scanResult = null
    let nextToken = null
    let limit = pageLimit ?? SCAN_LIMIT_COUNT
    do {
      //limit件数分ページング分割して取得
      scanResult = await this.appSyncClient.query({
        query: queryParam.query,
        variables: {
          ...queryParam.variables,
          limit,
          nextToken,
        },
      })

      //scanのデータ取得（先頭の要素を取得）
      let dataResult = scanResult.data[Object.keys(scanResult.data)[0]]

      allItems.push(...dataResult.items)
      nextToken = dataResult.nextToken

    } while (nextToken !== null)

    //最後ののscan実行結果に、全scanデータを設定
    scanResult.data[Object.keys(scanResult.data)[0]].items = allItems

    return scanResult
  }

  /**
   * 一括登録（batchWrite）
   * @param {string} tableName テーブル名
   * @param {object} items 登録データ
   * @returns 実行結果
   */
  async batchWrite(tableName, items) {

    // 一括登録処理はGraphQLを使用せず、直接DynamoDBへ登録する
    // ※カスタムリゾルバ使用することで、GraphQLでも一括登録可能だが、メンテナンス性を考慮して、直接DynamoDBへ登録する
    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })

    // テーブル名の取得
    // ※環境変数に「API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT」を設定する必要がある
    if (!process.env['API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT']) {
      throw new Error('Environment variable[API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT] does not exist')
    }
    const tableNameEnv = tableName + '-' + process.env['API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT'] + '-' + process.env['ENV']

    // 一括登録処理
    for (let i = 0; i < items.length;) {

      // 一括登録の登録最大件数は25件のため、25件単位で登録を行う
      let params = { RequestItems: {} }
      params.RequestItems[tableNameEnv] = []

      for (let j = 0; j < 25 && i < items.length; i++, j++) {
        //登録レコードの設定
        params.RequestItems[tableNameEnv].push({
          PutRequest: {
            Item: items[i]
          }
        })
      }
      await documentClient.batchWrite(params).promise()
    }
  }

  /**
   * 一括取得（batchGet）
   * @param {String} tableName テーブル名
   * @param {Array} keys キーリスト
   * @returns 実行結果
   */
  async batchGet(tableName, keys) {

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })

    // テーブル名の取得
    // ※環境変数に「API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT」を設定する必要がある
    if (!process.env['API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT']) {
      throw new Error('Environment variable[API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT] does not exist')
    }
    const tableNameEnv = tableName + '-' + process.env['API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT'] + '-' + process.env['ENV']

    let unprocessedKeys = keys.slice()
    let items = []

    while (unprocessedKeys.length > 0) {
      let limit = 100
      let batchKeys = unprocessedKeys.splice(0, limit)
      let params = {
        TableName: tableNameEnv,
        RequestItems: {
          [tableNameEnv]: {
            Keys: batchKeys,
          },
        },
      }
      let res = await documentClient.batchGet(params).promise()
      items = items.concat(res.Responses[tableNameEnv])
      if (res.UnprocessedKeys[tableNameEnv] != undefined) {
        unprocessedKeys = unprocessedKeys.concat(res.UnprocessedKeys[tableNameEnv].Keys)
      }
    }
    return items
  }

  /**
   * 一括削除（batchDelete）
   * @param {String} tableName テーブル名
   * @param {Array} keys キーリスト
   * @returns 実行結果
   */
  async batchDelete(tableName, keys) {

    // 一括登録処理はGraphQLを使用せず、直接DynamoDBへ登録する
    // ※カスタムリゾルバ使用することで、GraphQLでも一括登録可能だが、メンテナンス性を考慮して、直接DynamoDBへ登録する
    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })

    // テーブル名の取得
    // ※環境変数に「API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT」を設定する必要がある
    if (!process.env['API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT']) {
      throw new Error('Environment variable[API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT] does not exist')
    }
    const tableNameEnv = tableName + '-' + process.env['API_HEALTHCAREGRAPHQL_GRAPHQLAPIIDOUTPUT'] + '-' + process.env['ENV']

    // 一括登録処理
    for (let i = 0; i < keys.length;) {

      // 一括登録の登録最大件数は25件のため、25件単位で登録を行う
      let params = { RequestItems: {} }
      params.RequestItems[tableNameEnv] = []

      for (let j = 0; j < 25 && i < keys.length; i++, j++) {
        //登録レコードの設定
        params.RequestItems[tableNameEnv].push({
          DeleteRequest: {
            Key: keys[i]
          }
        })
      }
      await documentClient.batchWrite(params).promise()
    }
  }
}