// import { DictionaryEntities, WorkerEntities } from '@oxeo/devkit'

// export namespace RefsTypes {
//   // @ReferenceSet

//   export interface ReferenceSet {
//     refType: 'reference-set'
//     model: string
//     relationsCollectionName: string
//     cascadeCleanup: boolean
//   }

//   export interface ReferenceSetInverse {
//     refType: 'reference-set'
//     model: string
//     modelConsumerProperty: string // поле для обращения при unlink зачистке
//     onDeleteBehavior: 'unlink' | 'restrict'
//     relationsCollectionName: string
//   }

//   // @ReferenceTo

//   export interface ReferenceTo {
//     refType: 'reference-to'
//     model: string
//     relationsCollectionName: string // все что произойдет при удалении, это очистка связи в таблице
//   }

//   export interface ReferenceToInverse {
//     refType: 'reference-to'
//     model: string
//     modelConsumerProperty: string // поле для обращения при set-null зачистке
//     onDeleteBehavior: 'set-null' | 'restrict' // означает, что мы не можем удалить project, если есть хотя бы один shift который его использует
//     relationsCollectionName: string
//   }

//   // @HasMany

//   export interface HasMany {
//     model: string
//     refType: 'has-many'
//     modelDiscriminator?: string // модель может быть дискриминирована
//     modelBelongsToProperty: string
//     cascadeCleanup: boolean
//   }

//   // @BelongsTo

//   export interface BelongsTo {
//     model: string
//     refType: 'belongs-to'
//     modelDiscriminator?: string // модель может быть дискриминирована
//     modelHasManyProperty: string
//   }
// }

// // prettier-ignore
// export type TargetRefsTypes = RefsTypes.ReferenceSet | RefsTypes.ReferenceTo | RefsTypes.HasMany | RefsTypes.BelongsTo
// export type InverseRefsTypes = RefsTypes.ReferenceSetInverse | RefsTypes.ReferenceToInverse

// // карта связей
// export interface ReferenceScheme {
//   // определенная модель
//   [model: string]: {
//     // refs - схема содержащихся в модели связей
//     refs: {
//       // при совершении изменений над proxy-draft объектом, будут вычисленны патчи,
//       // некоторые из которых могут относиться к полям-связям (полям, использующих декораторы-связи)
//       // В случае если адрес изменения относится к такого рода полям, патч проинициирует дополнительные вычисления.
//       // Поэтому, адрес каждого патча должен быть эффективно проверен на наличие связей у свойства

//       // Для этого, создана специальная карта полей-связей по каждой модели:
//       // Также карта используется при удалении экземпляра модели, для очищения связей указывающих на данную модель
//       // (также, при необходимости, производится выполнение каскадного удаления связанных сущностей)
//       [address: string]: TargetRefsTypes
//     }
//     // для дискриминированных моделей (определенные связи могут быть у объекта в зависимости от его дискриминатора)
//     discriminators?: {
//       [discriminator: string]: {
//         [address: string]: TargetRefsTypes
//       }
//     }
//     // inverseRefs представляет массив потребителей модели в свойствах других моделей (по связям ReferenceTo/ReferenceSet)
//     // Используется при удалении экземпляра модели, для удаления указывающих ссылок на нее в других моделях.
//     // Также проверяется, нет ли потребителей запрещающих удаление данной модели
//     inverseRefs: InverseRefsTypes[]
//   }
// }

// // Процесс удаления
// // При удалении экземпляра модели, сперва происходит поиск потребителей по карте inverseRefs, поскольку
// // потребители модели могут заблокировать удаление. Если блокирующих удаление потребителей нет, происходит
// // очищение ссылки на удаляющуюся модель у всех ее потребителей, а затем, используя refs вызывается
// // очищение связей данной модели с другими данными

// export const referencesScheme: ReferenceScheme = {
//   worker: {
//     refs: {
//       'about.regions': {
//         model: 'option',
//         refType: 'reference-set',
//         relationsCollectionName: 'refs_worker_and_option_in_about_regions',
//         cascadeCleanup: false
//       },
//       'contacts.film.actors': {
//         refType: 'reference-set',
//         model: 'option',
//         cascadeCleanup: false,
//         relationsCollectionName: ''
//       }
//     },
//     discriminators: {
//       office: {
//         roles: {
//           model: 'option',
//           refType: 'reference-set',
//           cascadeCleanup: false,
//           relationsCollectionName: ''
//         }
//       },
//       revisor: {
//         seats: {
//           model: 'seats',
//           refType: 'has-many', // has-many + false cascadeCleanup + массив ссылок не пуст - удаление будет блокироваться
//           modelBelongsToProperty: 'revisorId', // свойство будет задействовано при cascadeCleanup
//           cascadeCleanup: false
//         }
//       }
//     },
//     inverseRefs: []
//   },
//   seats: {
//     refs: {
//       revisorId: {
//         model: 'worker',
//         refType: 'belongs-to',
//         modelHasManyProperty: 'seats' // будет использоваться при очищении ссылки
//       },
//       shiftId: {
//         model: 'shift',
//         refType: 'belongs-to',
//         modelHasManyProperty: 'seats'
//       }
//     },
//     inverseRefs: []
//   },
//   dictionary: {
//     refs: {
//       regions: {
//         // +новый inverse-потребитель в option:
//         model: 'option',
//         refType: 'reference-set',
//         cascadeCleanup: true, // cascadeCleanup has only in target-side
//         relationsCollectionName: 'refs_dictionary_and_option_in_regions'
//       }
//     },
//     inverseRefs: []
//   },
//   option: {
//     refs: {},
//     // все потребители, которые содержат указания/отсылки на option:
//     inverseRefs: [
//       {
//         model: 'worker',
//         modelConsumerProperty: 'about.regions', //
//         refType: 'reference-set',
//         onDeleteBehavior: 'unlink',
//         relationsCollectionName: 'refs_worker_and_option_in_about_regions'
//       },
//       {
//         model: 'worker',
//         refType: 'reference-set',
//         modelConsumerProperty: 'contacts.film.actors',
//         onDeleteBehavior: 'unlink',
//         relationsCollectionName: ''
//       },
//       {
//         model: 'worker',
//         refType: 'reference-set',
//         modelConsumerProperty: 'roles', // but in discriminator ()
//         onDeleteBehavior: 'unlink',
//         relationsCollectionName: ''
//       },
//       // в самом классе option нет никаких декораторов связей, однако на option происходит ссылка из другой модели
//       // на базе этой информации генерируется данный указатель.
//       {
//         model: 'dictionary',
//         modelConsumerProperty: 'regions',
//         refType: 'reference-set',
//         onDeleteBehavior: 'unlink',
//         relationsCollectionName: 'refs_dictionary_and_option_in_regions'
//       }
//     ]
//   },
//   project: {
//     refs: {
//       curatorId: {
//         model: 'worker',
//         refType: 'reference-to', // reference-to в target-стороне означает, что project потребляет (держит ссылку) на определенную модель worker (никакие блокировки не предусматриваются при удалении, только очищение связи. )
//         relationsCollectionName: 'refs_project_and_worker_in_clientId'
//       }
//     },
//     // все потребители, которые содержат указания/отсылки на project:
//     inverseRefs: [
//       {
//         model: 'shift',
//         modelConsumerProperty: 'projectId', // мы бы обратились к полю при удалении с поведением set-null
//         refType: 'reference-to',
//         onDeleteBehavior: 'restrict', // означает, что мы не можем удалить project, если есть хотя бы один shift который его использует
//         relationsCollectionName: 'refs_shift_and_project_in_projectId'
//       },
//       {
//         model: 'client',
//         modelConsumerProperty: 'projects', // мы обратимся к полю чтобы удалить ссылку при удалении с настройкой поведения unlink
//         refType: 'reference-set',
//         onDeleteBehavior: 'unlink', // при удалении project, ссылка на него автоматически исчезнет из поля projects в client модели
//         relationsCollectionName: 'refs_client_and_project_in_projects'
//       }
//     ]
//   }
// }

// //////////////////////////////////////////////////////////////////////////////////////////////
// // relationsCollections - хранилище связей по связям referenceSet/referenceTo
// // Формат записей: { model_a[Id], model_b[Id] }

// // все записи в таблицах должны быть проиндексированы с обеих сторон — относительно каждого поля связанных моделей. Данная необходимость обусловлена тем, что
// // запрос на получение списка связей может исходить от любой из двух моделей (любая из сторон связи может быть удалена), а запрос должен быть выполнен максимально эффективно (с наименьшим количеством вычислений, ценой использования памяти)
// //////////////////////////////////////////////////////////////////////////////////////////////

// export const relationsCollections = {
//   refs_worker_to_option_in_about_regions: [
//     { workerId: 1, optionId: 'shanghai' }
//     // relative to worker:
//     // 1: ['shanghai'] (пример при удалении worker: удяляем данную связь)
//     // relative to option:
//     // 'shanghai': [1] (пример при удалении option: удаляем связь и очищаем зависимость в worker, для этого, обращаемся к коллекции worker по workerId и по адресу about.regions удаляем элемент shanghai)
//   ],
//   refs_dictionary_option_in_regions: [
//     { dictionaryId: 'regions', optionId: 'shanghai' }, // note: в случае группировки данных по различным аккаунтам, пользователю будет необходимо объявить системное поле accountId для получения диапазона записей по нужному аккаунту (и проиндексировать его со стороны бд)
//     { dictionaryId: 'regions', optionId: 'moscow' },
//     { dictionaryId: 'regions', optionId: 'hongkong' },
//     { dictionaryId: 'regions', optionId: 'tokyo' }
//     // relative to option:
//     // 'shanghai': ['regions']
//     // relative to dictionary:
//     // 'regions': ['shanghai', 'moscow', 'hongkong', 'tokyo']
//   ]
// }

// // ################################################################################################################################################
// // #                                                     Пример организации связей                                                                #
// // ################################################################################################################################################

// const options: DictionaryEntities.Option[] = [
//   { title: 'Шанхай', value: 'shanghai', dictionary: 'regions' },
//   { title: 'Москва', value: 'moscow', dictionary: 'regions' },
//   { title: 'Гонконг', value: 'hongkong', dictionary: 'regions' },
//   { title: 'Токио', value: 'tokyo', dictionary: 'regions' }
// ]

// const dictionaries: DictionaryEntities.Dictionary[] = [
//   {
//     dictionary: 'regions',
//     name: 'Регионы',
//     options: ['shanghai', 'moscow', 'hongkong', 'tokyo']
//   }
// ]

// const workers: WorkerEntities.RevisorProfile[] = [
//   // {
//   //   workerId: 1,
//   //   type: 'revisor',
//   //   revisor_role: 'commmon',
//   //   seats: [],
//   //   email: 'mail@email.ru',
//   //   job_type: 'not_self_employed',
//   //   name: '',
//   //   surname: '',
//   //   patronymic: '',
//   //   sex: 'famale',
//   //   status: 'working',
//   //   password: '',
//   //   tgid: null,
//   //   avatar: {
//   //     stage: 'empthy'
//   //   },
//   //   bank_cards: [],
//   //   bank_details: [],
//   //   scans: [],
//   //   about: {
//   //     clothing_size: '',
//   //     employments: [],
//   //     height: 1,
//   //     kind_of_work: [],
//   //     regions: [],
//   //     shoe_size: ''
//   //   },
//   //   documents: {
//   //     passport_issued_by: '',
//   //     passport_issued_date: { day: 1, month: 1, year: 2000 },
//   //     inn: '',
//   //     citizenship: 'Rossiya',
//   //     snils: '',
//   //     passport_number: '',
//   //     passport_serial: '',
//   //     place_of_birth: '',
//   //     registration_place: ''
//   //   },
//   //   contacts: {
//   //     phone_base: '',
//   //     phone_base_verified: false,
//   //     phone_extra: '',
//   //     phone_extra_verified: false,
//   //     telegram_phone: '',
//   //     telegram_phone_verified: false,
//   //     telegram_nickname: '',
//   //     whatsapp_phone: '',
//   //     whatsapp_verified: false,
//   //     viber_phone: '',
//   //     viber_verified: false,
//   //     film: { anime: '', isTheater: false, actors: [] }
//   //   },
//   //   date_birth: {
//   //     day: 1,
//   //     month: 1,
//   //     year: 2000
//   //   },
//   //   date_employ: {
//   //     day: 1,
//   //     month: 1,
//   //     year: 2000
//   //   },
//   //   createdAt: 0
//   // }
// ]

// export const m1 = [options, dictionaries, workers]

// // const appCollections = {
// //   worker: createDiscriminatedCollection({
// //     baseScheme: WorkerEntities.BaseWorker,
// //     discriminators: [WorkerEntities.OfficeProfile, WorkerEntities.RevisorProfile],
// //     identifier: 'workerId',
// //     data: workers
// //   }),
// //   dictionaries: createCollection(DictionaryEntities.Dictionary, {
// //     data: dictionaries,
// //     identifier: 'dictionary'
// //   }),
// //   options: createCollection(DictionaryEntities.Option, {
// //     data: options,
// //     identifier: 'value'
// //   })
// // }

// // update метод обнаруживает изменения, проверяет модификации связей, производит соответствующие изменения связей, либо блокировку
// // appCollections.worker.update(1, (draft) => {
// //   draft.email = 'email@mail.ru'
// //   draft.about.regions.push('shanghai') // при удалении опции shanghai, ссылка не нее удаляется у владеющего им worker, и также в dictionaries
// // })

// // В будущем:

// // метод tryUpdate не применяет изменения, а лишь проверяет их на легитимность, в случае чего выкидывает ошибку
// // const update = appCollections.worker.tryUpdate(1, (draft) => {
// //   draft.email = 'email@mail.ru'
// //   draft.about.regions.push('shanghai')
// // })

// // Сохранение и применение изменений:

// // 1: Offline-mode

// // update.commit() // применяет изменения (может выкинуть ошибку, так как метод заново проверят блокировки, поскольку может быть вызван в аснихронном коде)
// // update.save() // отправляет патчи на сервер (может выкинуть ошибку, из за конкурентного изменения модели)

// // 2: Online-mode:

// // в .save() могут быть переданы дополнительные параметры запускающие определенные серверные side-эффекты (со своим жизненным циклом - до применения изменений / либо после успешных изменений)
// // update.save().then(() => {
// //   update.commit()
// // })

// // В реализации, где клиент отправляет запрос на сервер с уже определенными патчами, серверу не придется подписываться на изменения объекта.
// // Однако, в данном подходе к применению изменений основанных на патчах, нужны дополнительные правила и различные проверки на уровне модели, для чего должны быть сделаны соответствующие декораторы
// // Классы управления изменениями над моделями не будет общими, общими будут только модели, с их правилами. Клиент же, может производить любые легитимные операции над моделями и отправлять соответствующие патчи на сервер

// // Cерверые side эффекты могут запускаться при определенных условиях, и могут требовать дополнительные параметры (передающиеся save методу)
