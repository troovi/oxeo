export const scheme = {
  Option: {
    hasBlocking: false,
    hasCascadeDeleting: false, // cascade deleting may have blocking
    refs: {
      dictionary: {
        refType: 'belongs-to',
        model: 'Dictionary',
        modelHasManyProperty: 'options'
      }
    },
    inverseRefs: [
      {
        refType: 'reference-to',
        model: 'Location',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'location_type',
        relationsCollectionName: 'refs_Location_and_Option_location_type'
      },
      {
        refType: 'reference-to',
        model: 'Location',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'value_type',
        relationsCollectionName: 'refs_Location_and_Option_value_type'
      },
      {
        refType: 'reference-set',
        model: 'Project',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'type_of_works',
        relationsCollectionName: 'refs_Project_and_Option_type_of_works'
      },
      {
        refType: 'reference-set',
        model: 'Shift',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'extra_rates',
        relationsCollectionName: 'refs_Shift_and_Option_extra_rates'
      },
      {
        refType: 'reference-set',
        model: 'Shift',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'equipments',
        relationsCollectionName: 'refs_Shift_and_Option_equipments'
      },
      {
        refType: 'reference-set',
        model: 'Shift',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'type_of_work',
        relationsCollectionName: 'refs_Shift_and_Option_type_of_work'
      },
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'contacts.film.actors',
        relationsCollectionName: 'refs_Worker_and_Option_contacts_film_actors'
      },
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'about.regions',
        relationsCollectionName: 'refs_Worker_and_Option_about_regions'
      },
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'about.kind_of_work',
        relationsCollectionName: 'refs_Worker_and_Option_about_kind_of_work'
      },
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'about.employments',
        relationsCollectionName: 'refs_Worker_and_Option_about_employments'
      }
    ]
  },
  Dictionary: {
    refs: {
      options: {
        refType: 'has-many',
        model: 'Option',
        cleanupBehavior: 'cascade',
        modelBelongsToProperty: 'dictionary'
      }
    },
    inverseRefs: []
  },
  Role: {
    refs: {},
    inverseRefs: [
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'roles',
        relationsCollectionName: 'refs_Worker_and_Role_roles'
      }
    ]
  },
  Legal: {
    refs: {},
    inverseRefs: [
      {
        refType: 'reference-to',
        model: 'Location',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'legalId',
        relationsCollectionName: 'refs_Location_and_Legal_legalId'
      },
      {
        refType: 'reference-set',
        model: 'Client',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'legals',
        relationsCollectionName: 'refs_Client_and_Legal_legals'
      }
    ]
  },
  Location: {
    refs: {
      legalId: {
        refType: 'reference-to',
        model: 'Legal',
        relationsCollectionName: 'refs_Location_and_Legal_legalId'
      },
      location_type: {
        refType: 'reference-to',
        model: 'Option',
        relationsCollectionName: 'refs_Location_and_Option_location_type'
      },
      value_type: {
        refType: 'reference-to',
        model: 'Option',
        relationsCollectionName: 'refs_Location_and_Option_value_type'
      }
    },
    inverseRefs: [
      {
        refType: 'reference-set',
        model: 'Contact',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'locations',
        relationsCollectionName: 'refs_Contact_and_Location_locations'
      },
      {
        refType: 'reference-set',
        model: 'Client',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'locations',
        relationsCollectionName: 'refs_Client_and_Location_locations'
      },
      {
        refType: 'reference-set',
        model: 'Project',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'locationsIds',
        relationsCollectionName: 'refs_Project_and_Location_locationsIds'
      },
      {
        refType: 'reference-to',
        model: 'Shift',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'locationId',
        relationsCollectionName: 'refs_Shift_and_Location_locationId'
      }
    ]
  },
  Contact: {
    refs: {
      locations: {
        refType: 'reference-set',
        model: 'Location',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Contact_and_Location_locations'
      }
    },
    inverseRefs: [
      {
        refType: 'reference-set',
        model: 'Client',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'contacts',
        relationsCollectionName: 'refs_Client_and_Contact_contacts'
      }
    ]
  },
  Client: {
    refs: {
      managerId: {
        refType: 'reference-to',
        model: 'Worker',
        relationsCollectionName: 'refs_Client_and_Worker_managerId'
      },
      legals: {
        refType: 'reference-set',
        model: 'Legal',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Client_and_Legal_legals'
      },
      locations: {
        refType: 'reference-set',
        model: 'Location',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Client_and_Location_locations'
      },
      contacts: {
        refType: 'reference-set',
        model: 'Contact',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Client_and_Contact_contacts'
      },
      projects: {
        refType: 'reference-set',
        model: 'Project',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Client_and_Project_projects'
      }
    },
    inverseRefs: [
      {
        refType: 'reference-to',
        model: 'Project',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'clientId',
        relationsCollectionName: 'refs_Project_and_Client_clientId'
      }
    ]
  },
  Project: {
    refs: {
      clientId: {
        refType: 'reference-to',
        model: 'Client',
        relationsCollectionName: 'refs_Project_and_Client_clientId'
      },
      locationsIds: {
        refType: 'reference-set',
        model: 'Location',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Project_and_Location_locationsIds'
      },
      curatorId: {
        refType: 'reference-to',
        model: 'Worker',
        relationsCollectionName: 'refs_Project_and_Worker_curatorId'
      },
      managerId: {
        refType: 'reference-to',
        model: 'Worker',
        relationsCollectionName: 'refs_Project_and_Worker_managerId'
      },
      type_of_works: {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Project_and_Option_type_of_works'
      }
    },
    inverseRefs: [
      {
        refType: 'reference-set',
        model: 'Client',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'projects',
        relationsCollectionName: 'refs_Client_and_Project_projects'
      },
      {
        refType: 'reference-to',
        model: 'Shift',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'projectId',
        relationsCollectionName: 'refs_Shift_and_Project_projectId'
      }
    ]
  },
  Chat: {
    refs: {},
    inverseRefs: [],
    discriminators: {
      notechat: {
        shiftId: {
          model: 'Shift',
          refType: 'owner-fallback'
        }
      },
      seatchat: {
        seatId: {
          model: 'Seat',
          refType: 'owner-fallback'
        }
      }
    }
  },
  Seat: {
    refs: {
      revisorId: {
        refType: 'belongs-to',
        model: 'Worker',
        modelHasManyProperty: 'seats'
      },
      shiftId: {
        refType: 'belongs-to',
        model: 'Shift',
        modelHasManyProperty: 'seats'
      },
      chatId: {
        model: 'Chat',
        refType: 'owner'
      }
    },
    inverseRefs: []
  },
  Shift: {
    refs: {
      projectId: {
        refType: 'reference-to',
        model: 'Project',
        relationsCollectionName: 'refs_Shift_and_Project_projectId'
      },
      locationId: {
        refType: 'reference-to',
        model: 'Location',
        relationsCollectionName: 'refs_Shift_and_Location_locationId'
      },
      extra_rates: {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Shift_and_Option_extra_rates'
      },
      equipments: {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Shift_and_Option_equipments'
      },
      type_of_work: {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Shift_and_Option_type_of_work'
      },
      seats: {
        refType: 'has-many',
        model: 'Seat',
        cleanupBehavior: 'restrict',
        modelBelongsToProperty: 'shiftId'
      },
      chatId: {
        model: 'Chat',
        refType: 'owner'
      }
    },
    inverseRefs: []
  },
  BankDetail: {
    refs: {},
    inverseRefs: [
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'bank_details',
        relationsCollectionName: 'refs_Worker_and_BankDetail_bank_details'
      }
    ]
  },
  BankCard: {
    refs: {},
    inverseRefs: [
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'bank_cards',
        relationsCollectionName: 'refs_Worker_and_BankCard_bank_cards'
      }
    ]
  },
  Scan: {
    refs: {},
    inverseRefs: [
      {
        refType: 'reference-set',
        model: 'Worker',
        onDeleteBehavior: 'unlink',
        modelConsumerProperty: 'scans',
        relationsCollectionName: 'refs_Worker_and_Scan_scans'
      }
    ]
  },
  Worker: {
    refs: {
      'contacts.film.actors': {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Worker_and_Option_contacts_film_actors'
      },
      'about.regions': {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Worker_and_Option_about_regions'
      },
      'about.kind_of_work': {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Worker_and_Option_about_kind_of_work'
      },
      'about.employments': {
        refType: 'reference-set',
        model: 'Option',
        cascadeCleanup: false,
        relationsCollectionName: 'refs_Worker_and_Option_about_employments'
      },
      scans: {
        refType: 'reference-set',
        model: 'Scan',
        cascadeCleanup: true,
        relationsCollectionName: 'refs_Worker_and_Scan_scans'
      },
      bank_cards: {
        refType: 'reference-set',
        model: 'BankCard',
        cascadeCleanup: true,
        relationsCollectionName: 'refs_Worker_and_BankCard_bank_cards'
      },
      bank_details: {
        refType: 'reference-set',
        model: 'BankDetail',
        cascadeCleanup: true,
        relationsCollectionName: 'refs_Worker_and_BankDetail_bank_details'
      }
    },
    inverseRefs: [
      {
        refType: 'reference-to',
        model: 'Client',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'managerId',
        relationsCollectionName: 'refs_Client_and_Worker_managerId'
      },
      {
        refType: 'reference-to',
        model: 'Project',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'curatorId',
        relationsCollectionName: 'refs_Project_and_Worker_curatorId'
      },
      {
        refType: 'reference-to',
        model: 'Project',
        onDeleteBehavior: 'restrict',
        modelConsumerProperty: 'managerId',
        relationsCollectionName: 'refs_Project_and_Worker_managerId'
      }
    ],
    discriminators: {
      office: {
        roles: {
          refType: 'reference-set',
          model: 'Role',
          cascadeCleanup: false,
          relationsCollectionName: 'refs_Worker_and_Role_roles'
        }
      },
      revisor: {
        seats: {
          refType: 'has-many',
          model: 'Seat',
          cleanupBehavior: 'restrict',
          modelBelongsToProperty: 'revisorId'
        }
      }
    }
  }
}
