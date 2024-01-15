import 'reflect-metadata'
import { JSONArray, JSONObject, JSONPrimitive, JSONValue } from './json-types'

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

const getNestedKeyRoot = (path: string): string => (path.includes(':') ? path.split(':')[0] : path)

export function Restrict(permission?: Permission): PropertyDecorator {
  return function (target, propertyKey) {
    if (!Reflect.hasOwnMetadata('permissions', target.constructor)) {
      Reflect.defineMetadata('permissions', new Map(), target.constructor)
    }
    permission = permission ?? (target instanceof Store && target.defaultPolicy ? target.defaultPolicy : 'none')
    Reflect.getOwnMetadata('permissions', target.constructor).set(propertyKey, permission)
  }
}

export class Store implements IStore {
  defaultPolicy: Permission = 'rw'

  allowedToRead(key: string): boolean {
    const nestedKeyRoot: string = getNestedKeyRoot(key)
    return Boolean(
      Reflect.getMetadata('permissions', this.constructor)?.get(key)?.includes('r') ||
        (!Reflect.getMetadata('permissions', this.constructor)?.has(key) && this.defaultPolicy.includes('r')) ||
        Reflect.getMetadata('permissions', this.constructor)?.get(nestedKeyRoot)?.includes('r')
    )
  }

  allowedToWrite(key: string): boolean {
    const nestedKeyRoot: string = getNestedKeyRoot(key)
    return Boolean(
      Reflect.getMetadata('permissions', this.constructor)?.get(key)?.includes('w') ||
        (!Reflect.getMetadata('permissions', this.constructor)?.has(key) && this.defaultPolicy.includes('w')) ||
        Reflect.getMetadata('permissions', this.constructor)?.get(nestedKeyRoot)?.includes('w')
    )
  }

  read(path: string): StoreResult {
    if (!this.allowedToRead(path)) throw new Error('No')

    const nestedKeyRoot: string = getNestedKeyRoot(path)
    if (
      this.hasOwnProperty(nestedKeyRoot) &&
      Object.getOwnPropertyDescriptor(this, nestedKeyRoot)?.value instanceof Store
    ) {
      const [, ...childStorePath] = path.split(':')
      return Object.getOwnPropertyDescriptor(this, nestedKeyRoot)?.value.read(childStorePath)
    }

    return Object.getOwnPropertyDescriptor(this, path)?.value
  }

  write(path: string, value: StoreValue): StoreValue {
    if (!this.allowedToWrite(path)) throw new Error('No')

    if (!path.includes(':')) return Object.defineProperty(this, path, { value })

    const pathArray = path.split(':')
    if (
      this.hasOwnProperty(pathArray[0]) &&
      Object.getOwnPropertyDescriptor(this, pathArray[0])?.value instanceof Store
    ) {
      pathArray.shift()
      return Object.getOwnPropertyDescriptor(this, pathArray[0])?.value.write(pathArray.join(':'), value)
    }

    const newStoreName = pathArray[0]
    pathArray.shift()
    Object.defineProperty(this, newStoreName, {
      value: new Store(),
      enumerable: true,
      writable: true,
      configurable: true,
    })
    Object.getOwnPropertyDescriptor(this, newStoreName)?.value.write(pathArray.join(':'), value)
  }

  writeEntries(entries: JSONObject): void {
    for (const key in entries) {
      this.write(key, entries[key])
    }
  }

  entries(): JSONObject {
    return {}
  }
}
