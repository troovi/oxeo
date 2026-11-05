import { Link } from 'react-router'

interface SectionTile {
  to: string
  title: string
  count: number
}

/** Разделы приложения плитками: название и число записей, плитка ведёт в список. */
export const SectionTiles = ({ tiles }: { tiles: SectionTile[] }) => {
  return (
    <div className="section-tiles">
      {tiles.map((tile) => (
        <Link key={`tile-${tile.to}`} className="section-tile" to={tile.to}>
          <span className="section-tile-title">{tile.title}</span>
          <span className="section-tile-count">{tile.count}</span>
        </Link>
      ))}
    </div>
  )
}
