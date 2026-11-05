type Distinct<T, DistinctName> = T & { __TYPE__?: DistinctName; __SOURCE__?: T }

export namespace FileInput {
  export type Single<Name> = Distinct<Name, 'Single'> // name -> Express.Multer.File
  export type SingleOptional<Name> = Distinct<Name, 'SingleOptional'> // name -> Express.Multer.File | undefined
  export type Set<Name> = Distinct<Name, 'Set'> // name -> { name: Express.Multer.File[] }
  export type Map<Names> = Distinct<Names, 'Map'> // foo, bar  -> { foo: [Express.Multer.File], bar: [Express.Multer.File] }
}

// prettier-ignore
export type AnyFileInput = FileInput.Single<unknown> | FileInput.SingleOptional<unknown> | FileInput.Set<unknown> | FileInput.Map<unknown>

// basic route scheme
export type IOpattern<T extends IOpattern<T>> = {
  [key in keyof T]: {
    params: T[key]['params']
    answer: T[key]['answer']
  }
}

// params with files
export type IOFpattern<T extends IOFpattern<T>> = {
  [key in keyof T]: {
    files: AnyFileInput
    params: T[key]['params']
    answer: T[key]['answer']
  }
}

// just file (with no params)
export type IOFLpattern<T extends IOFLpattern<T>> = {
  [key in keyof T]: {
    files: AnyFileInput
    answer: T[key]['answer']
  }
}

export type GetParams<IO> = IO extends { params: infer T } ? T : never
export type GetAnswer<IO> = IO extends { answer: infer T } ? T : never

// server transformers

export type MapToDownloadScheme<T extends IOpattern<T>> = {
  [K in keyof T]: (props: T[K]['params'], ...args: any) => Promise<Buffer> // StreamableFile
}

export type RoutesToScheme<T extends IOpattern<T>> = {
  [K in keyof T]: (props: T[K]['params'], ...args: any) => Promise<T[K]['answer']>
}

// file with params
// prettier-ignore
export type MapToUploadScheme<T extends IOFpattern<T>> = {
  [K in keyof T]: (file: FileArgument<T[K]['files']>, props: Stringify<T[K]['params']>, ...args: any) => Promise<T[K]['answer']>
}

// file without params
export type MapToUploadLiteScheme<T extends IOFLpattern<T>> = {
  [K in keyof T]: (file: FileArgument<T[K]['files']>, ...args: any) => Promise<T[K]['answer']>
}

// helpers

export type Stringify<T> = {
  [K in keyof T]: string
}

export type FileArgument<T extends AnyFileInput> = T extends FileInput.Single<unknown>
  ? Express.Multer.File
  : T extends FileInput.SingleOptional<unknown>
  ? Express.Multer.File | undefined
  : T extends FileInput.Set<infer N>
  ? { [k in N & string]: Express.Multer.File[] }
  : T extends FileInput.Map<infer N>
  ? { [K in N & string]: [Express.Multer.File] }
  : never
