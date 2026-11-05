import { createForm } from '@companix/formkit'
import { Input } from '@companix/uikit'
import { ErrorsMessages } from '../layouts/ErrorsMessages'

interface Params {
  placeholder?: string
}

export const InputForm = createForm<string, Params>({
  defaultValue: '',
  getRequireCheck: () => (value) => {
    if (value.trim() === '') {
      throw ''
    }
  },
  getForm: (params) => {
    return ({ field: { ref, onChange, value }, error, disabled }) => {
      return (
        <div className="form-field">
          <Input
            {...params}
            value={value}
            onValueChange={onChange}
            inputRef={ref}
            required={error !== null}
            disabled={disabled}
          />
          {error && <ErrorsMessages error={error} />}
        </div>
      )
    }
  }
})
