import { FieldError } from '@companix/formkit'

export const ErrorsMessages = ({ error }: { error: FieldError }) => {
  if (!error.messages) {
    return null
  }

  return (
    <div className="form-errors">
      {error.messages.map((message, i) => (
        <div key={`error-message-${i}`} className="form-errors-message">
          {message}
        </div>
      ))}
    </div>
  )
}
