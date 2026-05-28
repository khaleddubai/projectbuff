/**
 * AEGIS — Express Type Augmentations
 *
 * Extends Express's Request type with the organizationId property
 * that is set by the authentication middleware for multi-tenant scoping.
 */

declare namespace Express {
  interface Request {
    /** Organization (tenant) ID set by authMiddleware */
    organizationId?: string;
  }
}

export {};
