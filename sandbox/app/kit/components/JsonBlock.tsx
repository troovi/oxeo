import { JsonView } from 'react-json-view-lite'

/**
 * Классы дерева `react-json-view-lite` — свои, со стилями песочницы (`json-block.scss`): стили библиотеки
 * не подключаются.
 */
const TREE_STYLE = {
  container: 'json-tree',
  basicChildStyle: 'json-tree-node',
  childFieldsContainer: 'json-tree-children',
  label: 'json-tree-label',
  clickableLabel: 'json-tree-label json-tree-label-clickable',
  nullValue: 'json-tree-null',
  undefinedValue: 'json-tree-null',
  stringValue: 'json-tree-string',
  booleanValue: 'json-tree-boolean',
  numberValue: 'json-tree-number',
  otherValue: 'json-tree-other',
  punctuation: 'json-tree-punctuation',
  expandIcon: 'json-tree-icon json-tree-icon-expand',
  collapseIcon: 'json-tree-icon json-tree-icon-collapse',
  collapsedContent: 'json-tree-collapsed',
  noQuotesForStringValues: false,
  quotesForFieldNames: false,
  ariaLables: { collapseJson: 'Свернуть', expandJson: 'Развернуть' },
  stringifyStringValues: false
}

/**
 * Открыты корень и его поля, глубже — свёрнуто: свёрнутый узел не рисуется, и снимок в сотни килобайт
 * не стоит ничего, пока его не раскрыли. Функция одна на все рендеры — дерево сбрасывает раскрытие при
 * новой.
 */
const isExpanded = (level: number) => {
  return level < 2
}

/**
 * Значение JSON деревом: узел сворачивается и разворачивается кликом по имени свойства (или по стрелке у
 * корня), значения подсвечены по типу.
 */
export const JsonBlock = ({ value }: { value: unknown }) => {
  if (value === null || typeof value !== 'object') {
    return <pre className="json-block json-block-primitive">{JSON.stringify(value) ?? 'undefined'}</pre>
  }

  return (
    <div className="json-block">
      <JsonView data={value} style={TREE_STYLE} shouldExpandNode={isExpanded} clickToExpandNode />
    </div>
  )
}
