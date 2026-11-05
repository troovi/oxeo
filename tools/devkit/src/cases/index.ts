import { caseAAA } from './basic/creating'
import { caseDWO } from './basic/creating-discriminated'
import { caseFIX, caseJRO, caseKRO } from './basic/error-model-not-exists'
import { caseFIA, caseFIB, caseFIC } from './basic/find-methods'
import { caseVIA } from './basic/update'
import { caseXNI } from './basic/update-discriminated'
import { caseCDA } from './basic/change-discriminator/success'
import { caseCDB } from './basic/change-discriminator/success-reverse'
import { caseCDU } from './basic/change-discriminator/error-via-update'
import { caseCDD } from './basic/change-discriminator/error-dependency'
import { caseCDS, caseCDK, caseCDN } from './basic/change-discriminator/error-invalid-target'
import { caseNIX } from './complex/check-removing'
import { caseMFO } from './complex/crossmodels-cleanup-on-remove'
import { caseMOS } from './complex/recursive-removing'
import { caseLXA } from './relations/belongs-to-has-many/creating'
import { caseMNX } from './relations/belongs-to-has-many/error-discriminator'
import { caseFNQ, caseJRI } from './relations/belongs-to-has-many/error-not-exists'
import { caseGNQ } from './relations/belongs-to-has-many/error-remove-has-many-restrict'
import { caseKEO } from './relations/belongs-to-has-many/error-restrict-create'
import { caseMOX } from './relations/belongs-to-has-many/error-restrict-update'
import { caseLAN } from './relations/belongs-to-has-many/remove-belongs-to-entity'
import { caseHIE } from './relations/belongs-to-has-many/remove-has-many-cascade'
import { caseMDI } from './relations/owner-to-owner-fallback/creating'
import { caseJXA, caseRIO } from './relations/owner-to-owner-fallback/error-on-fallback-invalid'
import { caseNIP } from './relations/owner-to-owner-fallback/error-on-fallback-remove'
import { caseQAX } from './relations/owner-to-owner-fallback/remove-owner'
import { caseAIX } from './relations/reference-set/creating'
import { caseWIO } from './relations/reference-set/creating-few'
import { caseAOX, caseMWO } from './relations/reference-set/error-not-exists'
import { caseNOL, caseUZO } from './relations/reference-set/error-unique'
import { caseWZX } from './relations/reference-set/linking-adding'
import { caseEMI } from './relations/reference-set/linking-clean'
import { caseDMA } from './relations/reference-set/linking-combine'
import { caseRYU } from './relations/reference-set/linking-replace'
import { caseSAO } from './relations/reference-set/linking-shrink'
import { caseISX, caseJXI } from './relations/reference-set/remove-cascade'
import { caseFMO, caseXIA } from './relations/reference-set/remove-entity'
import { caseMOR } from './relations/reference-set/remove-entity-few'
import { caseCAX, casePUX } from './relations/reference-set/remove-inverse-unlink'
import { caseRJO } from './relations/reference-to/creating'
import { caseONO, caseOPX } from './relations/reference-to/error-not-exists'
import { caseKJI } from './relations/reference-to/error-on-remove'
import { caseNIO } from './relations/reference-to/replace-ref'
import {
  caseSIA,
  caseSIB,
  caseSIC,
  caseSID,
  caseSIE,
  caseUIA
} from './relations/reference-to/set-null-on-remove'

// export const cases = [caseRIO]

export const cases = [
  // basic
  caseAAA,
  caseDWO,
  caseFIX,
  caseJRO,
  caseKRO,
  caseFIA,
  caseFIB,
  caseFIC,
  caseXNI,
  caseVIA,
  // basic/change-discriminator
  caseCDA,
  caseCDB,
  caseCDU,
  caseCDD,
  caseCDS,
  caseCDK,
  caseCDN,
  // relations/reference-set
  caseWIO,
  caseAIX,
  caseMWO,
  caseAOX,
  caseNOL,
  caseUZO,
  caseWZX,
  caseEMI,
  caseDMA,
  caseRYU,
  caseSAO,
  caseJXI,
  caseISX,
  caseMOR,
  caseFMO,
  caseXIA,
  casePUX,
  caseCAX,
  // relations/reference-to
  caseRJO,
  caseONO,
  caseOPX,
  caseKJI,
  caseNIO,
  caseSIA,
  caseSIB,
  caseSIC,
  caseUIA,
  caseSID,
  caseSIE,
  // relations/belongs-to-has-many
  caseLXA,
  caseMNX,
  caseJRI,
  caseFNQ,
  caseGNQ,
  caseKEO,
  caseMOX,
  caseLAN,
  caseHIE,
  // relations/owner-to-owner-fallback
  caseMDI,
  caseJXA,
  caseRIO,
  caseNIP,
  caseQAX,
  // complex
  caseNIX,
  caseMFO,
  caseMOS
]

export {
  // basic
  caseAAA,
  caseDWO,
  caseFIX,
  caseJRO,
  caseKRO,
  caseFIA,
  caseFIB,
  caseFIC,
  caseXNI,
  caseVIA,
  // basic/change-discriminator
  caseCDA,
  caseCDB,
  caseCDU,
  caseCDD,
  caseCDS,
  caseCDK,
  caseCDN,
  // relations/reference-set
  caseWIO,
  caseAIX,
  caseMWO,
  caseAOX,
  caseNOL,
  caseUZO,
  caseWZX,
  caseEMI,
  caseDMA,
  caseRYU,
  caseSAO,
  caseJXI,
  caseISX,
  caseMOR,
  caseFMO,
  caseXIA,
  casePUX,
  caseCAX,
  // relations/reference-to
  caseRJO,
  caseONO,
  caseOPX,
  caseKJI,
  caseNIO,
  caseSIA,
  caseSIB,
  caseSIC,
  caseSID,
  caseSIE,
  // relations/belongs-to-has-many
  caseLXA,
  caseMNX,
  caseJRI,
  caseFNQ,
  caseGNQ,
  caseKEO,
  caseMOX,
  caseLAN,
  caseHIE,
  // relations/owner-to-owner-fallback
  caseMDI,
  caseJXA,
  caseRIO,
  caseNIP,
  caseQAX,
  // complex
  caseNIX,
  caseMFO,
  caseMOS
}
