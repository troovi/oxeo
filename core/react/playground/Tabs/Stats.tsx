import { useCount } from '../dataSource'
import { Renders, useRenderCount } from '../use-render-count'

export const Stats = () => {
  const renders = useRenderCount()

  return (
    <section>
      <h3>
        Stats <Renders count={renders} />
      </h3>
      <StatRow collection="role" />
      <StatRow collection="worker" />
      <StatRow collection="project" />
      <StatRow collection="shift" />
      <StatRow collection="client" />
    </section>
  )
}

const StatRow = ({ collection }: { collection: Parameters<typeof useCount>[0] }) => {
  const count = useCount(collection)
  return (
    <div>
      {String(collection)}: {count}
    </div>
  )
}
