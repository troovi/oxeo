import { MongooseModuleOptions } from '../../lib/mongoose-options.interface'

const DB_NAME = 'oxeo-test'
const DB_PORT = 27017
const DB_AUTH = 'admin'
const DB_PASS = 'example'
const DB_HOST = '127.0.0.1'
const DB_CERT = ''
const DB_USER = 'root'

export const getMongoConnectionURL = (): string => {
  return `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/`
}

export const getMongoConnectionOptions = (): MongooseModuleOptions => {
  return {
    tls: DB_CERT ? true : false,
    tlsCAFile: DB_CERT,
    dbName: DB_NAME,
    authSource: DB_AUTH
  }
}
