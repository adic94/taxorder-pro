/**
 * Opcjonalny magazyn offline dla danych roboczych i kolejki synchronizacji.
 * Nie zastępuje jeszcze Storage i nie wysyła danych automatycznie.
 */
(function () {
  if (!window.Dexie) {
    console.error('[OfflineStore] Dexie nie został załadowany');
    return;
  }

  const db = new window.Dexie('taxorder-offline');
  db.version(1).stores({
    vehicles: 'id, companyId, registrationNumber, updatedAt',
    outbox: '++id, companyId, type, createdAt, status',
  });

  async function putVehicle(vehicle, companyId) {
    if (!vehicle || !vehicle.id || !companyId) throw new Error('vehicle.id i companyId są wymagane');
    const record = {
      ...vehicle,
      companyId: String(companyId),
      updatedAt: new Date().toISOString(),
    };
    await db.vehicles.put(record);
    return record;
  }

  async function queue(type, payload, companyId) {
    if (!type || !payload || !companyId) throw new Error('type, payload i companyId są wymagane');
    return db.outbox.add({
      companyId: String(companyId),
      type: String(type),
      payload,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });
  }

  async function pending(companyId) {
    if (!companyId) throw new Error('companyId jest wymagane');
    return db.outbox
      .where('companyId').equals(String(companyId))
      .and(item => item.status === 'pending')
      .sortBy('createdAt');
  }

  async function flush(companyId, sender) {
    if (!companyId || typeof sender !== 'function') throw new Error('companyId i sender są wymagane');
    const items = await pending(companyId);
    const sent = [];
    for (const item of items) {
      await sender(item);
      await db.outbox.update(item.id, { status: 'sent', sentAt: new Date().toISOString() });
      sent.push(item.id);
    }
    return sent;
  }

  window.TaxOrderOffline = {
    db,
    putVehicle,
    queue,
    pending,
    flush,
  };
})();
