import { JSONArray, JSONObject, JSONPrimitive } from './json-types'

export type Permission = 'r' | 'w' | 'rw' | 'none'

export type StoreResult = Store | JSONPrimitive | undefined

export type StoreValue = JSONObject | JSONArray | StoreResult | (() => StoreResult)

export interface IStore {
  defaultPolicy: Permission
  allowedToRead(key: string): boolean
  allowedToWrite(key: string): boolean
  read(path: string): StoreResult
  write(path: string, value: StoreValue): StoreValue
  writeEntries(entries: JSONObject): void
  entries(): JSONObject
}

const isReadable = (permission: Permission): boolean => permission.includes('r')
const isWritable = (permission: Permission): boolean => permission.includes('w')

export function Restrict(permission?: Permission): PropertyDecorator {
  return function (target, propertyKey) {
    permission = permission ?? (target instanceof Store && target.defaultPolicy ? target.defaultPolicy : 'none')
    Object.defineProperty(target, propertyKey, { enumerable: isReadable(permission), writable: isWritable(permission) })
  }
}

export class Store implements IStore {
  defaultPolicy: Permission = 'rw'

  allowedToRead(key: string): boolean {
    return Boolean(Object.getOwnPropertyDescriptor(this, key)?.enumerable || !this.hasOwnProperty(key))
  }

  allowedToWrite(key: string): boolean {
    return Boolean(Object.getOwnPropertyDescriptor(this, key)?.writable || !this.hasOwnProperty(key))
  }

  read(path: string): StoreResult {
    if (!this.allowedToRead(path)) return
    return Object.getOwnPropertyDescriptor(this, path)?.value
  }

  write(path: string, value: StoreValue): StoreValue {
    if (!this.allowedToWrite(path)) return
    Object.defineProperty(this, path, { value })
  }

  writeEntries(entries: JSONObject): void {
    return
  }

  entries(): JSONObject {
    return {}
  }
}
