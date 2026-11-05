// import { Patchers } from './libs'

// const obj = {
//   age: 18,
//   name: 'Sam',
//   profile: {
//     birthday: 4,
//     info: {
//       caption: 'hi',
//       jobs: [
//         { cost: 1, skills: ['a', 'b', 'c'] },
//         { cost: 2, skills: ['a', 'b', 'c'] },
//         { cost: 3, skills: ['a', 'b', 'c'] },
//         { cost: 4, skills: ['a', 'b', 'c'] },
//         { cost: 5, skills: ['a', 'b', 'c'] }
//       ]
//     }
//   }
// }

// // const swap = (arr: any[], index1: number, index2: number) => {
// //   ;[arr[index1], arr[index2]] = [arr[index2], arr[index1]]
// // }

// // Мутация над draft может состоять из какого угодно количества операций над одними и теми же данными. Например мутация может трижды менять одну и ту же строку поля, добавить
// // элемент в массив, а затем его удалить, а затем еще раз добавить. То есть, полагаться на сами факты изменений, пытаясь их воспроизвести нельзя.
// // Нужно исходить из разницы между состоянием до и после мутации над draft, то есть вычислять diff, на основе которого формируется единый update-объект.

// const patches = Patchers.Internal(obj, (draft) => {
//   // draft.age = 19
//   draft.age = 12
//   draft.profile.info.caption = 'hello'
//   draft.profile.info.caption = 'o hi'
//   // draft.profile.info.caption = 'hi'
//   draft.profile.birthday = 12
//   // draft.profile.info.jobs[1].cost = 20

//   // draft.profile.info.jobs.forEach((item) => {
//   //   if (item.cost === 5) {
//   //     item.skills.push('v')
//   //   }
//   // })

//   // draft.profile.info.jobs = draft.profile.info.jobs.filter((job) => {
//   //   return job.cost > 2
//   // })

//   // draft.profile.info.jobs.push({ cost: 1, skills: [] })
//   // draft.profile.info.jobs.pop()

//   // draft.profile.info.jobs.shift()
//   // draft.profile.info.jobs.unshift({ cost: 0, skills: [] })
//   // draft.profile.info.jobs.splice(4, 0, { cost: 100, skills: ['1', '2', '3', '4', '5', '6'] })
//   // draft.profile.info.jobs.splice(2, 1)
//   // draft.profile.info.jobs.push({ cost: 6, skills: ['a'] })
//   // draft.profile.info.jobs.reverse()
//   // draft.profile.info.jobs[3].cost = 40

//   // const index = draft.profile.info.jobs.findIndex((job) => {
//   //   return job.cost === 100
//   // })

//   // if (index !== -1) {
//   //   swap(draft.profile.info.jobs[index].skills, 2, 4)
//   // }
// })

// console.log(obj)
// console.log(patches.changedPaths.map((path) => path.join('.')))
// console.log(patches.nextState)
// // console.log(result.update)
// // console.log(result.nextState)
// // console.log(result.patches)
