import { plainToInstance } from 'class-transformer'
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  validate,
  ValidationOptions,
  registerDecorator
} from 'class-validator'

@ValidatorConstraint({ async: true })
export class IsOneOfDtoConstraint implements ValidatorConstraintInterface {
  async validate(value: any, args: ValidationArguments) {
    const [dtos, discriptor] = args.constraints as [any[], string]

    if (!value) {
      return false
    }

    const dto = dtos.find((some) => {
      const classDescriptor = new some()[discriptor]

      if (classDescriptor) {
        return classDescriptor === value[discriptor]
      }

      console.warn('WARN: Set descriptor value to:', some)
    })

    if (dto) {
      const errors = await validate(plainToInstance(dto, value))

      if (errors.length === 0) {
        return true
      }

      console.error('ERRORs: ', dto, errors)
    }

    return false
  }

  defaultMessage(args: ValidationArguments) {
    return 'Data does not match'
  }
}

export function IsOneOf(dtos: [Function[], string], validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: dtos,
      validator: IsOneOfDtoConstraint
    })
  }
}
