import { Link } from 'react-router'
import { format } from '../format'

interface RecordFieldsProps {
  record: object
  /** Поля-ссылки: имя поля → путь записи, на которую оно ссылается; значение такого поля — ссылка. */
  links?: { [field: string]: string }
}

/** Поля записи: имя и значение в строку; вложенный объект и массив — компактным JSON. */
export const RecordFields = ({ record, links = {} }: RecordFieldsProps) => {
  return (
    <dl className="record-fields">
      {Object.keys(record).map((field) => {
        const text = format.value(record[field as keyof object])
        const to = links[field]

        return (
          <div key={`field-${field}`} className="record-fields-row">
            <dt className="record-fields-name">{field}</dt>
            <dd className="record-fields-value">
              {to ? (
                <Link className="record-fields-link" to={to}>
                  {text}
                </Link>
              ) : (
                text
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
