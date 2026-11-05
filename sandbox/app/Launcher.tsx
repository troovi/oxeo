import { versions } from './versions'

export const Launcher = () => {
  return (
    <div className="launcher">
      <h1 className="launcher-title">oxeo sandbox</h1>
      <p className="launcher-hint">
        Наброски версий библиотеки на одном примере: у каждой — своя поверхность библиотеки, схема и
        домены, сервер и клиент; экран у всех один. Сервер песочницы — порт 4500, версия отвечает под
        префиксом своего ключа.
      </p>
      <div className="launcher-list">
        {versions.map((version) => (
          <a key={`version-${version.key}`} className="launcher-card" href={`/${version.key}`}>
            <div className="launcher-card-title">{version.title}</div>
            <div className="launcher-card-description">{version.description}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
