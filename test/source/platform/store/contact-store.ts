/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:no-null-keyword

import { Contact, Key, KeyUtil } from '../../core/crypto/key';
import { OpenPGPKey } from '../../core/crypto/pgp/openpgp-key.js';

const DATA: Contact[] = [];

export type ContactUpdate = {
  email?: string;
  name?: string | null;
  pubkey?: Key;
  pending_lookup?: number;
  last_use?: number | null;
};

export class ContactStore {

  public static get = async (db: void, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    const result = DATA.filter(x => emailOrLongid.includes(x.email) ||
      (x.pubkey && emailOrLongid.includes(OpenPGPKey.fingerprintToLongid(x.pubkey.id))));
    return result;
  }

  public static update = async (db: void, email: string | string[], update: ContactUpdate): Promise<void> => {
    if (Array.isArray(email)) {
      await Promise.all(email.map(oneEmail => ContactStore.update(db, oneEmail, update)));
      return;
    }
    let [updated] = await ContactStore.get(db, [email]);
    if (!updated) { // updating a non-existing contact, insert it first
      updated = await ContactStore.obj({ email });
      DATA.push(updated);
    }
    if (update.pubkey?.isPrivate) {
      update.pubkey = await KeyUtil.asPublicKey(update.pubkey);
    }
    for (const k of Object.keys(update)) {
      // @ts-ignore
      updated[k] = update[k];
    }
    if (update.pubkey) {
      const key = typeof update.pubkey === 'string' ? await KeyUtil.parse(update.pubkey) : update.pubkey;
      updated.pubkey = key;
      updated.fingerprint = key.id;
      updated.pubkey_last_sig = key.lastModified ? Number(key.lastModified) : null;
      updated.expiresOn = key.expiration ? Number(key.expiration) : null;
      updated.has_pgp = 1;
    }
  }

  public static obj = async ({ email, name, pubkey, pendingLookup, lastUse, lastCheck, lastSig }: any): Promise<Contact> => {
    if (!pubkey) {
      return {
        email,
        name: name || null,
        pending_lookup: (pendingLookup ? 1 : 0),
        pubkey: undefined,
        has_pgp: 0, // number because we use it for sorting
        fingerprint: null,
        last_use: lastUse || null,
        pubkey_last_sig: null,
        pubkey_last_check: null,
        expiresOn: null
      };
    }
    const pk = await KeyUtil.parse(pubkey);
    const contact = {
      email,
      name,
      pubkey: pk,
      has_pgp: 1, // number because we use it for sorting
      fingerprint: pk.id,
      pending_lookup: pendingLookup,
      last_use: lastUse,
      pubkey_last_check: lastCheck,
      pubkey_last_sig: lastSig
    } as Contact;
    return contact;
  }

  public static save = async (db: any, contact: Contact | Contact[]): Promise<void> => {
    if (Array.isArray(contact)) {
      DATA.push(...contact);
    } else {
      DATA.push(contact);
    }
  }
}
