export interface TestParams<T, R> {
  source: T
  mutate: (draft: T) => void
  expect: R
  expectDirtyPaths?: (string | number)[][]
}

export const createTest = <T, R>(name: string, test: TestParams<T, R>) => {
  return { name, test }
}

export const swap = (arr: any[], index1: number, index2: number) => {
  ;[arr[index1], arr[index2]] = [arr[index2], arr[index1]]
}

export const cases = [
  createTest('a1', {
    source: { name: 'cris', age: 42 },
    mutate: (draft) => {
      draft.age = 12
      draft.name = 'kim'
    },
    expect: { name: 'kim', age: 12 },
    expectDirtyPaths: [['age'], ['name']]
  }),

  createTest('a2 repeated nested writes collapse to final state', {
    source: { profile: { info: { caption: 'hi' } } },
    mutate: (draft) => {
      draft.profile.info.caption = 'hello'
      draft.profile.info.caption = 'o hi'
      draft.profile.info.caption = 'hix'
    },
    expect: {
      profile: {
        info: {
          caption: 'hix'
        }
      }
    },
    expectDirtyPaths: [['profile', 'info', 'caption']]
  }),

  createTest('a3 add nested property', {
    source: { profile: { info: {} } },
    mutate: (draft) => {
      ;(draft.profile.info as Record<string, unknown>).caption = 'new'
    },
    expect: { profile: { info: { caption: 'new' } } },
    expectDirtyPaths: [['profile', 'info', 'caption']]
  }),

  createTest('a4 delete nested property', {
    source: { profile: { info: { caption: 'remove me', age: 10 } } },
    mutate: (draft) => {
      delete (draft.profile.info as Record<string, unknown>).caption
    },
    expect: { profile: { info: { age: 10 } } },
    expectDirtyPaths: [['profile', 'info', 'caption']]
  }),

  createTest('a5 alias nested object mutation', {
    source: { profile: { info: { caption: 'hi', score: 1 } } },
    mutate: (draft) => {
      const info = draft.profile.info
      info.caption = 'hello'
      info.score = 2
    },
    expect: { profile: { info: { caption: 'hello', score: 2 } } },
    expectDirtyPaths: [
      ['profile', 'info', 'caption'],
      ['profile', 'info', 'score']
    ]
  }),

  createTest('a6 replace full nested branch', {
    source: { profile: { info: { caption: 'hi' } }, age: 18 },
    mutate: (draft) => {
      draft.profile = {
        info: {
          caption: 'next',
          tag: 'x'
        }
      } as any
    },
    expect: { profile: { info: { caption: 'next', tag: 'x' } }, age: 18 },
    expectDirtyPaths: [['profile']]
  }),

  createTest('a7 assign one draft branch into another', {
    source: { left: { value: 1 }, right: { value: 2 } },
    mutate: (draft) => {
      draft.left = draft.right
    },
    expect: { left: { value: 2 }, right: { value: 2 } },
    expectDirtyPaths: [['left']]
  }),

  createTest('a8 array push object', {
    source: { items: [{ cost: 1 }, { cost: 2 }] },
    mutate: (draft) => {
      draft.items.push({ cost: 3 })
    },
    expect: { items: [{ cost: 1 }, { cost: 2 }, { cost: 3 }] },
    expectDirtyPaths: [['items']]
  }),

  createTest('a9 array push and pop keeps same state', {
    source: { items: [{ cost: 1 }, { cost: 2 }] },
    mutate: (draft) => {
      draft.items.push({ cost: 3 })
      draft.items.pop()
    },
    expect: { items: [{ cost: 1 }, { cost: 2 }] },
    expectDirtyPaths: [['items']]
  }),

  createTest('a10 array shift and unshift', {
    source: { items: [1, 2, 3] },
    mutate: (draft) => {
      draft.items.shift()
      draft.items.unshift(9, 8)
    },
    expect: { items: [9, 8, 2, 3] },
    expectDirtyPaths: [['items']]
  }),

  createTest('a11 array splice remove middle', {
    source: { items: [1, 2, 3, 4] },
    mutate: (draft) => {
      draft.items.splice(1, 2)
    },
    expect: {
      items: [1, 4]
    },
    expectDirtyPaths: [['items']]
  }),

  createTest('a12 array splice insert complex object', {
    source: {
      items: [{ id: 1 }, { id: 2 }]
    },
    mutate: (draft) => {
      draft.items.splice(1, 0, { id: 99, tags: ['a', 'b'] } as any)
    },
    expect: {
      items: [{ id: 1 }, { id: 99, tags: ['a', 'b'] }, { id: 2 }]
    },
    expectDirtyPaths: [['items']]
  }),

  createTest('a13 array reverse', {
    source: {
      items: [1, 2, 3, 4]
    },
    mutate: (draft) => {
      draft.items.reverse()
    },
    expect: {
      items: [4, 3, 2, 1]
    },
    expectDirtyPaths: [['items']]
  }),

  createTest('a14 array sort numbers', {
    source: {
      items: [4, 1, 3, 2]
    },
    mutate: (draft) => {
      draft.items.sort((a, b) => a - b)
    },
    expect: {
      items: [1, 2, 3, 4]
    },
    expectDirtyPaths: [['items']]
  }),

  createTest('a15 nested object inside array item', {
    source: {
      items: [{ profile: { score: 1 } }, { profile: { score: 2 } }]
    },
    mutate: (draft) => {
      draft.items[1].profile.score = 99
    },
    expect: {
      items: [{ profile: { score: 1 } }, { profile: { score: 99 } }]
    },
    expectDirtyPaths: [['items', '1', 'profile', 'score']]
  }),

  createTest('a16 nested arrays in arrays push', {
    source: {
      matrix: [
        [1, 2],
        [3, 4]
      ]
    },
    mutate: (draft) => {
      draft.matrix[1].push(5)
    },
    expect: {
      matrix: [
        [1, 2],
        [3, 4, 5]
      ]
    },
    expectDirtyPaths: [['matrix', '1']]
  }),

  createTest('a17 nested arrays direct index set', {
    source: {
      matrix: [
        [1, 2],
        [3, 4]
      ]
    },
    mutate: (draft) => {
      draft.matrix[0][1] = 20
      draft.matrix[1][0] = 30
    },
    expect: {
      matrix: [
        [1, 20],
        [30, 4]
      ]
    },
    expectDirtyPaths: [
      ['matrix', '0', '1'],
      ['matrix', '1', '0']
    ]
  }),

  createTest('a18 array of arrays splice and replace nested item', {
    source: {
      rows: [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }]]
    },
    mutate: (draft) => {
      draft.rows[0].splice(1, 0, { id: 'x' } as any)
      draft.rows[1][0] = { id: 'z' } as any
    },
    expect: {
      rows: [[{ id: 'a' }, { id: 'x' }, { id: 'b' }], [{ id: 'z' }]]
    },
    expectDirtyPaths: [
      ['rows', '0'],
      ['rows', '1', '0']
    ]
  }),

  createTest('a19 delete array slot', {
    source: {
      items: ['a', 'b', 'c']
    },
    mutate: (draft) => {
      delete draft.items[1]
    },
    expect: {
      items: ['a', undefined, 'c']
    },
    expectDirtyPaths: [['items', '1']]
  }),

  createTest('a20 top-level array source', {
    source: [{ value: 1 }, { value: 2 }, { value: 3 }],
    mutate: (draft) => {
      draft[1].value = 20
      draft.push({ value: 4 } as any)
    },
    expect: [{ value: 1 }, { value: 20 }, { value: 3 }, { value: 4 }],
    expectDirtyPaths: [[]]
  }),

  createTest('a21 no-op mutation only reads', {
    source: {
      profile: {
        info: {
          caption: 'hi'
        }
      },
      items: [1, 2, 3]
    },
    mutate: (draft) => {
      void draft.profile.info.caption
      void draft.items.length
      void draft.items[1]
    },
    expect: {
      profile: {
        info: {
          caption: 'hi'
        }
      },
      items: [1, 2, 3]
    },
    expectDirtyPaths: []
  }),

  createTest('a22 nested alias array element object mutation', {
    source: {
      items: [
        { title: 'a', meta: { score: 1 } },
        { title: 'b', meta: { score: 2 } }
      ]
    },
    mutate: (draft) => {
      const second = draft.items[1]
      second.meta.score = 20
      second.title = 'bb'
    },
    expect: {
      items: [
        { title: 'a', meta: { score: 1 } },
        { title: 'bb', meta: { score: 20 } }
      ]
    },
    expectDirtyPaths: [
      ['items', '1', 'meta', 'score'],
      ['items', '1', 'title']
    ]
  }),

  createTest('a23 replace nested array with fresh array', {
    source: {
      profile: {
        tags: ['a', 'b', 'c']
      }
    },
    mutate: (draft) => {
      draft.profile.tags = ['x', 'y']
    },
    expect: {
      profile: {
        tags: ['x', 'y']
      }
    },
    expectDirtyPaths: [['profile', 'tags']]
  }),

  createTest('a24 deep object and array mixed update', {
    source: {
      workspace: {
        projects: [
          {
            title: 'a',
            members: [{ name: 'sam' }, { name: 'kim' }]
          },
          {
            title: 'b',
            members: []
          }
        ]
      }
    },
    mutate: (draft) => {
      draft.workspace.projects[0].members[1].name = 'lee'
      draft.workspace.projects[1].members.push({ name: 'neo' } as any)
      draft.workspace.projects[1].title = 'bee'
    },
    expect: {
      workspace: {
        projects: [
          {
            title: 'a',
            members: [{ name: 'sam' }, { name: 'lee' }]
          },
          {
            title: 'bee',
            members: [{ name: 'neo' }]
          }
        ]
      }
    },
    expectDirtyPaths: [
      ['workspace', 'projects', '0', 'members', '1', 'name'],
      ['workspace', 'projects', '1', 'members'],
      ['workspace', 'projects', '1', 'title']
    ]
  }),

  createTest('a25 multi root mixed nested changes', {
    source: {
      user: {
        profile: {
          name: 'sam',
          stats: { age: 18, rating: 1 }
        }
      },
      settings: {
        theme: 'light',
        flags: { beta: false }
      },
      queue: [1, 2]
    },
    mutate: (draft) => {
      draft.user.profile.name = 'kim'
      draft.user.profile.stats.rating = 3
      draft.settings.theme = 'dark'
      draft.settings.flags.beta = true
      draft.queue.push(3)
    },
    expect: {
      user: {
        profile: {
          name: 'kim',
          stats: { age: 18, rating: 3 }
        }
      },
      settings: {
        theme: 'dark',
        flags: { beta: true }
      },
      queue: [1, 2, 3]
    },
    expectDirtyPaths: [
      ['user', 'profile', 'name'],
      ['user', 'profile', 'stats', 'rating'],
      ['settings', 'theme'],
      ['settings', 'flags', 'beta'],
      ['queue']
    ]
  }),

  createTest('a26 boards cards mixed structural updates', {
    source: {
      boards: [
        {
          title: 'todo',
          cards: [
            { text: 'a', tags: ['x'] },
            { text: 'b', tags: [] }
          ]
        },
        {
          title: 'done',
          cards: [{ text: 'c', tags: ['y'] }]
        }
      ]
    },
    mutate: (draft) => {
      draft.boards[0].cards[1].text = 'bb'
      draft.boards[0].cards.push({ text: 'd', tags: ['n'] } as any)
      draft.boards[1].cards[0].tags.push('done')
      draft.boards[1].title = 'closed'
    },
    expect: {
      boards: [
        {
          title: 'todo',
          cards: [
            { text: 'a', tags: ['x'] },
            { text: 'bb', tags: [] },
            { text: 'd', tags: ['n'] }
          ]
        },
        {
          title: 'closed',
          cards: [{ text: 'c', tags: ['y', 'done'] }]
        }
      ]
    },
    expectDirtyPaths: [
      ['boards', '0', 'cards'],
      ['boards', '1', 'cards', '0', 'tags'],
      ['boards', '1', 'title']
    ]
  }),

  createTest('a27 replace object in array and mutate sibling root', {
    source: {
      items: [
        { id: 1, meta: { score: 1 } },
        { id: 2, meta: { score: 2 } }
      ],
      audit: { updated: false }
    },
    mutate: (draft) => {
      draft.items[0] = { id: 10, meta: { score: 10 } } as any
      draft.items[1].meta.score = 20
      draft.audit.updated = true
    },
    expect: {
      items: [
        { id: 10, meta: { score: 10 } },
        { id: 2, meta: { score: 20 } }
      ],
      audit: { updated: true }
    },
    expectDirtyPaths: [
      ['items', '0'],
      ['items', '1', 'meta', 'score'],
      ['audit', 'updated']
    ]
  }),

  createTest('a28 nested matrix row reshapes', {
    source: {
      matrix: [[1, 2, 3], [4, 5], [6]]
    },
    mutate: (draft) => {
      draft.matrix[0].shift()
      draft.matrix[1].unshift(9)
      draft.matrix[2].push(7, 8)
    },
    expect: {
      matrix: [
        [2, 3],
        [9, 4, 5],
        [6, 7, 8]
      ]
    },
    expectDirtyPaths: [
      ['matrix', '0'],
      ['matrix', '1'],
      ['matrix', '2']
    ]
  }),

  createTest('a29 delete and recreate nested property', {
    source: {
      profile: {
        info: {
          caption: 'hi',
          note: 'old'
        }
      }
    },
    mutate: (draft) => {
      delete (draft.profile.info as any).note
      ;(draft.profile.info as any).note = 'new'
      draft.profile.info.caption = 'hello'
    },
    expect: {
      profile: {
        info: {
          caption: 'hello',
          note: 'new'
        }
      }
    },
    expectDirtyPaths: [
      ['profile', 'info', 'note'],
      ['profile', 'info', 'caption']
    ]
  }),

  createTest('a30 sections blocks nested arrays', {
    source: {
      sections: [
        {
          blocks: [
            { type: 'text', content: 'a' },
            { type: 'gallery', images: ['1', '2'] }
          ]
        }
      ]
    },
    mutate: (draft) => {
      draft.sections[0].blocks[0].content = 'aa'
      ;(draft.sections[0].blocks[1] as any).images.splice(1, 0, 'x')
      draft.sections[0].blocks.push({ type: 'text', content: 'tail' } as any)
    },
    expect: {
      sections: [
        {
          blocks: [
            { type: 'text', content: 'aa' },
            { type: 'gallery', images: ['1', 'x', '2'] },
            { type: 'text', content: 'tail' }
          ]
        }
      ]
    },
    expectDirtyPaths: [['sections', '0', 'blocks']]
  }),

  createTest('a31 deep replace branch and leaf updates', {
    source: {
      tree: {
        left: { value: 1, meta: { flag: false } },
        right: { value: 2, meta: { flag: true } }
      }
    },
    mutate: (draft) => {
      draft.tree.left = { value: 10, meta: { flag: true } } as any
      draft.tree.right.meta.flag = false
      draft.tree.right.value = 20
    },
    expect: {
      tree: {
        left: { value: 10, meta: { flag: true } },
        right: { value: 20, meta: { flag: false } }
      }
    },
    expectDirtyPaths: [
      ['tree', 'left'],
      ['tree', 'right', 'meta', 'flag'],
      ['tree', 'right', 'value']
    ]
  }),

  createTest('a32 nested teams members queue', {
    source: {
      teams: [
        { name: 'a', members: [{ name: 'm1' }, { name: 'm2' }] },
        { name: 'b', members: [] }
      ],
      queue: [{ id: 1 }]
    },
    mutate: (draft) => {
      draft.teams[0].members.splice(1, 1, { name: 'm2x' } as any)
      draft.teams[1].members.push({ name: 'm3' } as any)
      draft.queue.unshift({ id: 0 } as any)
    },
    expect: {
      teams: [
        { name: 'a', members: [{ name: 'm1' }, { name: 'm2x' }] },
        { name: 'b', members: [{ name: 'm3' }] }
      ],
      queue: [{ id: 0 }, { id: 1 }]
    },
    expectDirtyPaths: [['teams', '0', 'members'], ['teams', '1', 'members'], ['queue']]
  }),

  createTest('a33 root branch alias and nested arrays', {
    source: {
      page: {
        header: { title: 'A' },
        content: {
          rows: [{ cols: [1, 2] }, { cols: [3] }]
        }
      }
    },
    mutate: (draft) => {
      const content = draft.page.content
      content.rows[0].cols.push(5)
      content.rows[1].cols[0] = 30
      draft.page.header.title = 'B'
    },
    expect: {
      page: {
        header: { title: 'B' },
        content: {
          rows: [{ cols: [1, 2, 5] }, { cols: [30] }]
        }
      }
    },
    expectDirtyPaths: [
      ['page', 'content', 'rows', '0', 'cols'],
      ['page', 'content', 'rows', '1', 'cols', '0'],
      ['page', 'header', 'title']
    ]
  }),

  createTest('a34 multiple sibling arrays and objects', {
    source: {
      tags: ['a'],
      users: [{ name: 'sam' }, { name: 'kim' }],
      meta: { count: 2, active: true }
    },
    mutate: (draft) => {
      draft.tags.push('b', 'c')
      draft.users[0].name = 's'
      draft.users.pop()
      draft.meta.count = 1
      draft.meta.active = false
    },
    expect: {
      tags: ['a', 'b', 'c'],
      users: [{ name: 's' }],
      meta: { count: 1, active: false }
    },
    expectDirtyPaths: [['tags'], ['users'], ['meta', 'count'], ['meta', 'active']]
  }),

  createTest('a35 array of objects with nested object replacement', {
    source: {
      items: [
        { id: 1, cfg: { a: 1, b: 2 } },
        { id: 2, cfg: { a: 3, b: 4 } }
      ]
    },
    mutate: (draft) => {
      draft.items[0].cfg = { a: 10, b: 20 } as any
      draft.items[1].cfg.a = 30
    },
    expect: {
      items: [
        { id: 1, cfg: { a: 10, b: 20 } },
        { id: 2, cfg: { a: 30, b: 4 } }
      ]
    },
    expectDirtyPaths: [
      ['items', '0', 'cfg'],
      ['items', '1', 'cfg', 'a']
    ]
  }),

  createTest('a36 nested comments and replies', {
    source: {
      comments: [
        {
          text: 'a',
          replies: [{ text: 'r1' }, { text: 'r2' }]
        }
      ]
    },
    mutate: (draft) => {
      draft.comments[0].replies[0].text = 'rr1'
      draft.comments[0].replies.push({ text: 'r3' } as any)
      draft.comments[0].text = 'aa'
    },
    expect: {
      comments: [
        {
          text: 'aa',
          replies: [{ text: 'rr1' }, { text: 'r2' }, { text: 'r3' }]
        }
      ]
    },
    expectDirtyPaths: [
      ['comments', '0', 'replies'],
      ['comments', '0', 'text']
    ]
  }),

  createTest('a37 replace nested array item then mutate next', {
    source: {
      list: [
        { val: 1, arr: [1] },
        { val: 2, arr: [2] },
        { val: 3, arr: [3] }
      ]
    },
    mutate: (draft) => {
      draft.list[1] = { val: 20, arr: [20, 21] } as any
      draft.list[2].arr.push(4)
    },
    expect: {
      list: [
        { val: 1, arr: [1] },
        { val: 20, arr: [20, 21] },
        { val: 3, arr: [3, 4] }
      ]
    },
    expectDirtyPaths: [
      ['list', '1'],
      ['list', '2', 'arr']
    ]
  }),

  createTest('a38 nested maps-like plain objects and arrays', {
    source: {
      groups: {
        a: { ids: [1, 2], enabled: true },
        b: { ids: [3], enabled: false }
      }
    },
    mutate: (draft) => {
      draft.groups.a.ids.pop()
      draft.groups.a.enabled = false
      draft.groups.b.ids.unshift(0)
      draft.groups.b.enabled = true
    },
    expect: {
      groups: {
        a: { ids: [1], enabled: false },
        b: { ids: [0, 3], enabled: true }
      }
    },
    expectDirtyPaths: [
      ['groups', 'a', 'ids'],
      ['groups', 'a', 'enabled'],
      ['groups', 'b', 'ids'],
      ['groups', 'b', 'enabled']
    ]
  }),

  createTest('a39 settings panels cards all mixed', {
    source: {
      layout: {
        panels: [{ cards: [{ id: 'a' }, { id: 'b' }] }, { cards: [{ id: 'c' }] }]
      },
      settings: { lang: 'en', compact: false }
    },
    mutate: (draft) => {
      draft.layout.panels[0].cards.reverse()
      draft.layout.panels[1].cards.push({ id: 'd' } as any)
      draft.settings.lang = 'fr'
      draft.settings.compact = true
    },
    expect: {
      layout: {
        panels: [{ cards: [{ id: 'b' }, { id: 'a' }] }, { cards: [{ id: 'c' }, { id: 'd' }] }]
      },
      settings: { lang: 'fr', compact: true }
    },
    expectDirtyPaths: [
      ['layout', 'panels', '0', 'cards'],
      ['layout', 'panels', '1', 'cards'],
      ['settings', 'lang'],
      ['settings', 'compact']
    ]
  }),

  createTest('a40 nested delete and array insert', {
    source: {
      book: {
        title: 'x',
        meta: { year: 2000, edition: 1 },
        chapters: [{ name: 'a' }, { name: 'b' }]
      }
    },
    mutate: (draft) => {
      delete (draft.book.meta as any).edition
      draft.book.chapters.splice(1, 0, { name: 'inserted' } as any)
      draft.book.title = 'xx'
    },
    expect: {
      book: {
        title: 'xx',
        meta: { year: 2000 },
        chapters: [{ name: 'a' }, { name: 'inserted' }, { name: 'b' }]
      }
    },
    expectDirtyPaths: [
      ['book', 'meta', 'edition'],
      ['book', 'chapters'],
      ['book', 'title']
    ]
  }),

  createTest('a41 array in array replace and shift', {
    source: {
      rows: [
        [1, 2, 3],
        [4, 5, 6]
      ]
    },
    mutate: (draft) => {
      draft.rows[0][0] = 10
      draft.rows[1].shift()
      draft.rows[1].push(7)
    },
    expect: {
      rows: [
        [10, 2, 3],
        [5, 6, 7]
      ]
    },
    expectDirtyPaths: [
      ['rows', '0', '0'],
      ['rows', '1']
    ]
  }),

  createTest('a42 nested projects tasks multiple branches', {
    source: {
      projects: [
        {
          title: 'a',
          tasks: [
            { title: 't1', done: false },
            { title: 't2', done: false }
          ]
        },
        {
          title: 'b',
          tasks: []
        }
      ]
    },
    mutate: (draft) => {
      draft.projects[0].tasks[0].done = true
      draft.projects[0].tasks[1].title = 'task-2'
      draft.projects[1].tasks.push({ title: 'nt', done: false } as any)
      draft.projects[1].title = 'bb'
    },
    expect: {
      projects: [
        {
          title: 'a',
          tasks: [
            { title: 't1', done: true },
            { title: 'task-2', done: false }
          ]
        },
        {
          title: 'bb',
          tasks: [{ title: 'nt', done: false }]
        }
      ]
    },
    expectDirtyPaths: [
      ['projects', '0', 'tasks', '0', 'done'],
      ['projects', '0', 'tasks', '1', 'title'],
      ['projects', '1', 'tasks'],
      ['projects', '1', 'title']
    ]
  }),

  createTest('a43 replace root nested branch with alias from sibling', {
    source: {
      sourceBranch: {
        nested: { value: 5 }
      },
      targetBranch: {
        nested: { value: 1 }
      }
    },
    mutate: (draft) => {
      draft.targetBranch = draft.sourceBranch
      draft.sourceBranch.nested.value = 10
    },
    expect: {
      sourceBranch: {
        nested: { value: 10 }
      },
      targetBranch: {
        nested: { value: 5 }
      }
    },
    expectDirtyPaths: [['targetBranch'], ['sourceBranch', 'nested', 'value']]
  }),

  createTest('a44 long chain leaf updates', {
    source: {
      a: {
        b: {
          c: {
            d: {
              e: {
                f: 1,
                g: 2
              }
            }
          }
        }
      }
    },
    mutate: (draft) => {
      draft.a.b.c.d.e.f = 10
      draft.a.b.c.d.e.g = 20
    },
    expect: {
      a: {
        b: {
          c: {
            d: {
              e: {
                f: 10,
                g: 20
              }
            }
          }
        }
      }
    },
    expectDirtyPaths: [
      ['a', 'b', 'c', 'd', 'e', 'f'],
      ['a', 'b', 'c', 'd', 'e', 'g']
    ]
  }),

  createTest('a45 large structural branch updates', {
    source: {
      form: {
        fields: [
          { name: 'first', value: 'a' },
          { name: 'last', value: 'b' }
        ],
        errors: []
      }
    },
    mutate: (draft) => {
      draft.form.fields.unshift({ name: 'prefix', value: 'mr' } as any)
      draft.form.fields[2].value = 'bb'
      ;(draft.form.errors as any[]).push('required')
    },
    expect: {
      form: {
        fields: [
          { name: 'prefix', value: 'mr' },
          { name: 'first', value: 'a' },
          { name: 'last', value: 'bb' }
        ],
        errors: ['required']
      }
    },
    expectDirtyPaths: [
      ['form', 'fields'],
      ['form', 'errors']
    ]
  }),

  createTest('a46 nested inventory with bins and slots', {
    source: {
      bins: [{ slots: [{ code: 'a' }, { code: 'b' }] }, { slots: [{ code: 'c' }] }]
    },
    mutate: (draft) => {
      draft.bins[0].slots.pop()
      draft.bins[0].slots.push({ code: 'bb' } as any)
      draft.bins[1].slots[0].code = 'cc'
    },
    expect: {
      bins: [{ slots: [{ code: 'a' }, { code: 'bb' }] }, { slots: [{ code: 'cc' }] }]
    },
    expectDirtyPaths: [
      ['bins', '0', 'slots'],
      ['bins', '1', 'slots', '0', 'code']
    ]
  }),

  createTest('a47 nested arrays multiple levels structural', {
    source: {
      cube: [[[1], [2, 3]], [[4, 5]]]
    },
    mutate: (draft) => {
      draft.cube[0][1].push(30)
      draft.cube[1].push([6, 7] as any)
      draft.cube[0][0][0] = 10
    },
    expect: {
      cube: [
        [[10], [2, 3, 30]],
        [
          [4, 5],
          [6, 7]
        ]
      ]
    },
    expectDirtyPaths: [
      ['cube', '0', '1'],
      ['cube', '1'],
      ['cube', '0', '0', '0']
    ]
  }),

  createTest('a48 sibling deletes and creates', {
    source: {
      obj: {
        a: 1,
        b: 2,
        c: 3
      }
    },
    mutate: (draft) => {
      delete (draft.obj as any).a
      delete (draft.obj as any).c
      delete (draft.obj as any).unk
      ;(draft.obj as any).d = 4
      draft.obj.b = 20
    },
    expect: {
      obj: {
        b: 20,
        d: 4
      }
    },
    expectDirtyPaths: [
      ['obj', 'a'],
      ['obj', 'c'],
      ['obj', 'd'],
      ['obj', 'b']
    ]
  }),

  createTest('a49 root array mixed nested and structural', {
    source: [
      { id: 1, tags: ['a'] },
      { id: 2, tags: ['b'] }
    ],
    mutate: (draft) => {
      draft[0].tags.push('aa')
      draft.push({ id: 3, tags: [] } as any)
      draft[1].id = 20
    },
    expect: [
      { id: 1, tags: ['a', 'aa'] },
      { id: 20, tags: ['b'] },
      { id: 3, tags: [] }
    ],
    expectDirtyPaths: [[]]
  }),

  createTest('a50 nested content map list and replacement', {
    source: {
      content: {
        hero: { title: 'hello', links: ['a'] },
        footer: { title: 'bye', links: ['x', 'y'] }
      }
    },
    mutate: (draft) => {
      draft.content.hero.links.push('b')
      draft.content.footer = { title: 'ciao', links: ['z'] } as any
    },
    expect: {
      content: {
        hero: { title: 'hello', links: ['a', 'b'] },
        footer: { title: 'ciao', links: ['z'] }
      }
    },
    expectDirtyPaths: [
      ['content', 'hero', 'links'],
      ['content', 'footer']
    ]
  }),

  createTest('a51 many nested leaves across tree', {
    source: {
      left: { a: { x: 1, y: 2 } },
      middle: { b: { z: 3 } },
      right: { c: { w: 4 } }
    },
    mutate: (draft) => {
      draft.left.a.x = 10
      draft.left.a.y = 20
      draft.middle.b.z = 30
      draft.right.c.w = 40
    },
    expect: {
      left: { a: { x: 10, y: 20 } },
      middle: { b: { z: 30 } },
      right: { c: { w: 40 } }
    },
    expectDirtyPaths: [
      ['left', 'a', 'x'],
      ['left', 'a', 'y'],
      ['middle', 'b', 'z'],
      ['right', 'c', 'w']
    ]
  }),

  createTest('a52 comments threads branch replacement and push', {
    source: {
      threads: [
        {
          comments: [{ text: 'a' }]
        },
        {
          comments: [{ text: 'b' }, { text: 'c' }]
        }
      ]
    },
    mutate: (draft) => {
      draft.threads[0].comments = [{ text: 'x' }, { text: 'y' }] as any
      draft.threads[1].comments.push({ text: 'd' } as any)
    },
    expect: {
      threads: [
        {
          comments: [{ text: 'x' }, { text: 'y' }]
        },
        {
          comments: [{ text: 'b' }, { text: 'c' }, { text: 'd' }]
        }
      ]
    },
    expectDirtyPaths: [
      ['threads', '0', 'comments'],
      ['threads', '1', 'comments']
    ]
  }),

  createTest('a53 nested profile arrays and booleans', {
    source: {
      users: [
        { name: 'a', active: true, roles: ['r1'] },
        { name: 'b', active: false, roles: ['r2', 'r3'] }
      ]
    },
    mutate: (draft) => {
      draft.users[0].roles.push('r4')
      draft.users[1].active = true
      draft.users[1].roles.splice(0, 1)
      draft.users[0].name = 'aa'
    },
    expect: {
      users: [
        { name: 'aa', active: true, roles: ['r1', 'r4'] },
        { name: 'b', active: true, roles: ['r3'] }
      ]
    },
    expectDirtyPaths: [
      ['users', '0', 'roles'],
      ['users', '1', 'active'],
      ['users', '1', 'roles'],
      ['users', '0', 'name']
    ]
  }),

  createTest('a54 giant mixed nested scenario', {
    source: {
      app: {
        nav: [{ label: 'home' }, { label: 'docs' }],
        pages: [
          {
            id: 'p1',
            blocks: [
              { kind: 'text', value: 'hello' },
              { kind: 'list', items: ['a', 'b'] }
            ]
          },
          {
            id: 'p2',
            blocks: []
          }
        ],
        config: {
          theme: 'light',
          enabled: true
        }
      },
      audit: {
        version: 1
      }
    },
    mutate: (draft) => {
      draft.app.nav[1].label = 'guide'
      ;(draft.app.pages[0].blocks[1] as any).items.push('c')
      draft.app.pages[1].blocks.push({ kind: 'text', value: 'new page' } as any)
      draft.app.config.theme = 'dark'
      draft.app.config.enabled = false
      draft.audit.version = 2
    },
    expect: {
      app: {
        nav: [{ label: 'home' }, { label: 'guide' }],
        pages: [
          {
            id: 'p1',
            blocks: [
              { kind: 'text', value: 'hello' },
              { kind: 'list', items: ['a', 'b', 'c'] }
            ]
          },
          {
            id: 'p2',
            blocks: [{ kind: 'text', value: 'new page' }]
          }
        ],
        config: {
          theme: 'dark',
          enabled: false
        }
      },
      audit: {
        version: 2
      }
    },
    expectDirtyPaths: [
      ['app', 'nav', '1', 'label'],
      ['app', 'pages', '0', 'blocks', '1', 'items'],
      ['app', 'pages', '1', 'blocks'],
      ['app', 'config', 'theme'],
      ['app', 'config', 'enabled'],
      ['audit', 'version']
    ]
  })
]
