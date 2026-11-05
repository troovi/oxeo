import { createLayout } from '@companix/formkit'
import { FormGroup } from '@companix/uikit'

interface Params {
  text: React.ReactNode
  required?: boolean
}

export const Label = createLayout(({ text, required }: Params) => {
  return ({ children }) => {
    return (
      <FormGroup
        label={
          <>
            {text}
            {required && <sub className="form-required">*</sub>}
          </>
        }
      >
        {children}
      </FormGroup>
    )
  }
})
