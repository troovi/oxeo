import * as assert from 'node:assert/strict'
import { describe, expect, test } from 'vitest'
import { schemaOf } from '@oxeo/scheme'
import { mock } from '../../../tools/devkit/src/scheme/scheme.mock'
import { RoleEntities } from '../../../tools/devkit/src/scheme/roles'
import { ClientEntities } from '../../../tools/devkit/src/scheme/clients'
import { ShiftEntities } from '../../../tools/devkit/src/scheme/shifts'
import { WorkerEntities } from '../../../tools/devkit/src/scheme/workers'
import { extractSchemaShape } from './extract-schema-shape'
import { expectParseFailure, expectParseSuccess } from './schema-of.helpers'
import { schemaShapeCases } from './schema-of.shapes'

describe('schemaOf', () => {
  describe('validation', () => {
    test('builds a zod schema for primitive models', () => {
      const schema = schemaOf(RoleEntities.Role)
      const role = mock.Role({ value: 'manager' })

      assert.deepEqual(expectParseSuccess(schema, role), role)

      expectParseFailure(schema, { ...role, value: 10 })
      expectParseFailure(schema, { ...role, createdAt: '1' })
    })

    test('maps reference ids using referenced model identifiers', () => {
      const schema = schemaOf(ClientEntities.Client)
      const client = {
        ...mock.Client({ clientId: 1, managerId: 10 }),
        subManagerId: 20,
        legals: ['legal-1'],
        locations: ['location-1'],
        contacts: ['contact-1'],
        projects: [2]
      }

      assert.deepEqual(expectParseSuccess(schema, client), client)

      expectParseFailure(schema, { ...client, managerId: '10' })
      expectParseFailure(schema, { ...client, legals: [1] })
      expectParseFailure(schema, { ...client, projects: ['2'] })
    })

    test('supports belongs-to and owner relations with nullable primitives', () => {
      const schema = schemaOf(ShiftEntities.Seat)
      const seat = {
        ...mock.Seat({
          seatId: 'seat-1',
          revisorId: 1,
          shiftId: 2,
          chatId: 'chat-1'
        }),
        subManagerId: 3,
        paid: null,
        confirmed: null,
        attendance: null
      }

      assert.deepEqual(expectParseSuccess(schema, seat), seat)

      expectParseFailure(schema, { ...seat, revisorId: '1' })
      expectParseFailure(schema, { ...seat, shiftId: '2' })
      expectParseFailure(schema, { ...seat, chatId: 1 })
      expectParseFailure(schema, { ...seat, status: 'draft' })
    })

    test('includes inherited identifiers and embedded objects for discriminators', () => {
      const schema = schemaOf(WorkerEntities.OfficeProfile)
      const baseOffice = mock.Office({ workerId: 1 })
      const office = {
        ...baseOffice,
        about: {
          ...baseOffice.about,
          height: null
        },
        documents: {
          ...baseOffice.documents,
          citizenship: null
        }
      }

      assert.equal('workerId' in schema.shape, true)
      assert.equal('contacts' in schema.shape, true)
      assert.deepEqual(expectParseSuccess(schema, office), office)

      expectParseFailure(schema, { ...office, email: 'not-an-email' })
      expectParseFailure(schema, {
        ...office,
        contacts: {
          ...office.contacts,
          film: {
            ...office.contacts.film,
            isTheater: 'yes'
          }
        }
      })
    })
  })

  describe('shape extraction', () => {
    test.each(schemaShapeCases)(
      'extracts a comparable object shape from zod schema for %s',
      (_, EntityClass, expectedShape) => {
        expect(extractSchemaShape(schemaOf(EntityClass as any))).toEqual(expectedShape)
      }
    )
  })

  describe('cache', () => {
    test('returns the same schema instance for repeated calls', () => {
      assert.equal(schemaOf(RoleEntities.Role), schemaOf(RoleEntities.Role))
      assert.notEqual(schemaOf(RoleEntities.Role), schemaOf(ClientEntities.Client))
    })
  })
})
