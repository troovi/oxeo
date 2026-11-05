import { z } from 'zod'

// Zod schema map
export namespace AppKeySchemas {
  export const Sex = z.enum(['male', 'famale'])
  export const WorkerStatus = z.enum(['working', 'fired'])
  export const RevisorRoles = z.enum(['commmon', 'senior', 'leader'])
  export const TypeOfShift = z.enum(['daytime', 'night', 'day'])

  export const Dictionaries = z.enum([
    'regions',
    'kind_of_work',
    'type_of_work',
    'equipments',
    'employment',
    'location_type',
    'extra_rates',
    'value_type'
  ])

  export const Citizenship = z.enum([
    'Rossiya',
    'Belorussiya',
    'Kazakhstan',
    'Kirgiziya',
    'Uzbekistan',
    'Tadzhikistan',
    'Azerbaydzhan',
    'Armeniya',
    'Moldaviya',
    'Turkmeniya',
    'Ukraina'
  ])

  export const PaymentMethod = z.enum(['cash', 'bank_card'])
  export const Attendance = z.enum(['on_time', 'late', 'adsent'])
  export const Confirmed = z.enum(['3d', '1d', '1h'])
  export const JobType = z.enum(['self_employed', 'not_self_employed'])
}

// Zod Schemas for AppKeys

export const AppKeys = {
  Sex: AppKeySchemas.Sex.options,
  WorkerStatus: AppKeySchemas.WorkerStatus.options,
  RevisorRoles: AppKeySchemas.RevisorRoles.options,
  TypeOfShift: AppKeySchemas.TypeOfShift.options,
  Dictionaries: AppKeySchemas.Dictionaries.options,
  Citizenship: AppKeySchemas.Citizenship.options,
  PaymentMethod: AppKeySchemas.PaymentMethod.options,
  Attendance: AppKeySchemas.Attendance.options,
  Confirmed: AppKeySchemas.Confirmed.options,
  JobType: AppKeySchemas.JobType.options
}

// Zod-based type extraction
export namespace AppKey {
  export type Sex = z.infer<typeof AppKeySchemas.Sex>
  export type WorkerStatus = z.infer<typeof AppKeySchemas.WorkerStatus>
  export type RevisorRoles = z.infer<typeof AppKeySchemas.RevisorRoles>
  export type TypeOfShift = z.infer<typeof AppKeySchemas.TypeOfShift>
  export type Citizenship = z.infer<typeof AppKeySchemas.Citizenship>
  export type Dictionaries = z.infer<typeof AppKeySchemas.Dictionaries>
  export type PaymentMethod = z.infer<typeof AppKeySchemas.PaymentMethod>
  export type Attendance = z.infer<typeof AppKeySchemas.Attendance>
  export type Confirmed = z.infer<typeof AppKeySchemas.Confirmed>
  export type JobType = z.infer<typeof AppKeySchemas.JobType>
}
