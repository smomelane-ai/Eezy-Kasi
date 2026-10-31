/* Eezy Kasi: Group Supply Orders (screens for shop owners, drivers and the admin, plus a demo mode).
   Loaded by index.html with one line: <script src="supply.js" defer></script>
   It uses the app's own helpers (sb, rpc, go, render, esc, R, msgs, H, ST, user, sess, tab, xtab, BANK).
   Open the app with #supply-demo at the end of the address to see the demo with sample data (no login needed). */
(function () {
  "use strict";

  // ---------------------------------------------------------------- small helpers
  const SAT = "Africa/Johannesburg";
  const num = v => Number(v) || 0;
  const pad5 = n => String(n).padStart(5, "0");
  const fmtDay = d => { try { return new Date(d + "T12:00:00+02:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: SAT }); } catch (e) { return d; } };
  const fmtCut = ts => { try { return new Date(ts).toLocaleString("en-ZA", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: SAT }); } catch (e) { return ""; } };
  const kindLabel = k => ({ bakery: "Bakery", distributor: "Wholesale", butchery: "Butchery", other: "Supplier" }[k] || "Supplier");
  const lineTxt = l => l.qty + " × " + l.item_name + (l.unit ? " (" + l.unit + ")" : "");
  const bar = (n, of) => `<div class="spbar" role="img" aria-label="${n} of ${of} shops have paid"><i style="width:${Math.min(100, Math.round(100 * n / Math.max(1, of)))}%"></i></div>`;

  const STATUS = {
    placed: ["Waiting for payment", "bad"], paid: ["Paid", "ok"], confirmed: ["Confirmed by supplier", "ok"],
    packed: ["Packed", "ok"], on_the_way: ["On the way", "ok"], delivered: ["Delivered", "ok"],
    dropped: ["Not paid in time", ""], cancelled: ["Cancelled", ""]
  };
  const BSTATUS = { open: ["Open for orders", ""], go: ["Delivery is on", "ok"], cancelled: ["Cancelled", ""], delivered: ["Delivered", "ok"] };

  // ---------------------------------------------------------------- state
  const SUP = {
    demo: false, demoRole: "own", demoTick: 0,
    loading: false, err: "",
    // owner
    view: "home", sid: null, date: null, cart: {}, suppliers: [], settings: { transport_cents: 2500, order_fee_percent: 5, driver_fee_percent: 15 },
    daysBy: {}, items: [], usual: [], orders: [],
    // driver
    open: [], mine: [], stops: {}, showStops: null,
    // admin
    atab: "todo", pend: [], over: [], refunds: [], payouts: [], pack: null, packBatch: null, allSup: [], aSid: null, aItems: []
  };
  window.SUP = SUP;

  // ---------------------------------------------------------------- real backend (Supabase)
  const uid = () => sess && sess.user && sess.user.id;
  const REAL = {
    suppliers: () => sb("/rest/v1/suppliers?select=id,name,kind&is_active=eq.true&order=name"),
    allSuppliers: () => sb("/rest/v1/suppliers?select=id,name,kind,is_active&order=name"),
    async settings() { const r = await sb("/rest/v1/supplier_settings?select=transport_cents,order_fee_percent,driver_fee_percent&id=eq.1"); return (r && r[0]) || SUP.settings; },
    days: sid => rpc("sg_next_days", { p_supplier: Number(sid), p_count: 4 }),
    items: sid => sb(`/rest/v1/supplier_items?select=id,supplier_id,name,unit,normal_price_cents,group_price_cents&supplier_id=eq.${Number(sid)}&is_available=eq.true&order=name`),
    usual: () => sb("/rest/v1/supplier_usual_items?select=item_id,qty"),
    async saveUsual(ids, rows) {
      if (ids.length) await sb(`/rest/v1/supplier_usual_items?item_id=in.(${ids.map(Number).join(",")})`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
      if (rows.length) await sb("/rest/v1/supplier_usual_items", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rows.map(r => ({ owner_id: uid(), item_id: r.item_id, qty: r.qty }))) });
    },
    place: (sid, date, lines) => rpc("sg_place_order", { p_supplier: Number(sid), p_date: date, p_lines: lines }),
    myOrders: () => sb(`/rest/v1/supplier_orders?select=id,status,goods_cents,fee_cents,transport_cents,total_cents,payment_ref,payment_marked_at,refund_due,refunded_at,supplier_batches(delivery_date,status,suppliers(name)),supplier_order_lines(item_name,unit,qty)&owner_id=eq.${uid()}&order=id.desc&limit=20`),
    markPaid: id => rpc("sg_mark_paid", { p_order: Number(id) }),
    cancel: id => rpc("sg_cancel_order", { p_order: Number(id) }),
    received: id => rpc("sg_confirm_received", { p_order: Number(id) }),
    // drivers
    openRuns: () => rpc("sg_open_runs", {}),
    myRuns: () => rpc("sg_my_runs", {}),
    stops: id => rpc("sg_run_stops", { p_run: Number(id) }),
    accept: id => rpc("sg_accept_run", { p_run: Number(id) }),
    pickedUp: id => rpc("sg_run_picked_up", { p_run: Number(id) }),
    // admin
    pending: () => rpc("sg_admin_pending_payments", {}),
    confirm: id => rpc("sg_admin_confirm_payment", { p_order: Number(id) }),
    overview: () => rpc("sg_admin_overview", {}),
    closeBatch: id => rpc("sg_close_batch", { p_batch: Number(id) }),
    packing: id => rpc("sg_packing_list", { p_batch: Number(id) }),
    refunds: () => sb("/rest/v1/supplier_orders?select=id,shop_name,shop_phone,total_cents,payment_ref&refund_due=eq.true&order=id"),
    refunded: id => rpc("sg_admin_mark_refunded", { p_order: Number(id) }),
    async payouts() {
      const r = await sb("/rest/v1/supplier_runs?select=id,payout_cents,fee_cents,driver_id,supplier_batches(delivery_date,suppliers(name))&status=eq.delivered&paid_out_at=is.null&order=id");
      const ids = [...new Set((r || []).map(x => x.driver_id).filter(Boolean))];
      let names = {};
      if (ids.length) { try { (await sb(`/rest/v1/drivers?select=id,full_name&id=in.(${ids.join(",")})`)).forEach(d => names[d.id] = d.full_name); } catch (e) {} }
      return (r || []).map(x => ({ ...x, driver_name: names[x.driver_id] || "Driver" }));
    },
    markPayout: id => rpc("sg_admin_mark_run_paid", { p_run: Number(id) }),
    adminItems: sid => sb(`/rest/v1/supplier_items?select=id,supplier_id,name,unit,normal_price_cents,group_price_cents,is_available&supplier_id=eq.${Number(sid)}&order=name`),
    addItem: o => sb("/rest/v1/supplier_items", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(o) }),
    setItem: (id, patch) => sb("/rest/v1/supplier_items?id=eq." + Number(id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) })
  };

  // ---------------------------------------------------------------- demo backend (sample data kept in memory)
  let D = null;
  const todaySA = () => new Date().toLocaleDateString("en-CA", { timeZone: SAT });
  function demoDays() {
    const out = []; const t = todaySA().split("-").map(Number);
    for (let i = 1; i <= 21 && out.length < 4; i++) {
      const dt = new Date(Date.UTC(t[0], t[1] - 1, t[2] + i)), wd = dt.getUTCDay();
      if (wd === 2 || wd === 4 || wd === 6) out.push(dt.toISOString().slice(0, 10));
    }
    return out;
  }
  function prevDay(ds) { const p = ds.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] - 1)).toISOString().slice(0, 10); }
  function mkDemo() {
    const days = demoDays();
    const d = {
      days,
      sup: [{ id: 1, name: "Sample Bakery", kind: "bakery", is_active: true }, { id: 2, name: "Sample Wholesale", kind: "distributor", is_active: true }, { id: 3, name: "Sample Butchery", kind: "butchery", is_active: true }],
      items: [
        [1, 1, "White bread", "loaf", 1800, 1500], [2, 1, "Brown bread", "loaf", 1900, 1600], [3, 1, "Hot dog rolls (6)", "pack", 2200, 1800],
        [4, 2, "Maize meal 10 kg", "bag", 11500, 9800], [5, 2, "Cooking oil 2 L", "bottle", 7200, 6400], [6, 2, "Sugar 2.5 kg", "bag", 5500, 4800], [7, 2, "Cooldrink 2 L (6 pack)", "pack", 9000, 7900],
        [8, 3, "Chicken pieces 10 kg", "box", 39000, 34500], [9, 3, "Polony 1 kg", "each", 4800, 4200], [10, 3, "Russians 1 kg", "each", 5500, 4900]
      ].map(a => ({ id: a[0], supplier_id: a[1], name: a[2], unit: a[3], normal_price_cents: a[4], group_price_cents: a[5], is_available: true })),
      batches: [], orders: [], runs: [], nextItem: 11, nextOrder: 1, nextRun: 1,
      sampleShops: [
        { shop_name: "Sipho's Spaza", phone: "0710000001", area: "Geneva" },
        { shop_name: "Mama Zodwa Fast Food", phone: "0710000002", area: "Geneva" },
        { shop_name: "Nomvula Beauty Corner", phone: "0710000003", area: "Congo" },
        { shop_name: "Thabo's Tuckshop", phone: "0710000004", area: "White City" }
      ]
    };
    let id = 1;
    d.sup.forEach(s => days.slice(0, 2).forEach((dt, k) => d.batches.push({ id: id++, sid: s.id, date: dt, status: "open", base: k === 0 ? ({ 1: 7, 2: 9, 3: 4 }[s.id]) : 2, closed: false })));
    return d;
  }
  const dBatch = id => D.batches.find(b => b.id === Number(id));
  const dSup = id => D.sup.find(s => s.id === Number(id));
  const dPaid = b => b.base + D.orders.filter(o => o.batch === b.id && ["paid", "confirmed", "packed", "on_the_way", "delivered"].includes(o.status)).length;
  const dLines = o => o.lines.map(l => ({ item_name: l.name, unit: l.unit, qty: l.qty }));
  const dOrderRow = o => { const b = dBatch(o.batch); return { id: o.id, status: o.status, goods_cents: o.goods, fee_cents: o.fee, transport_cents: o.transport, total_cents: o.goods + o.fee + o.transport, payment_ref: o.ref, payment_marked_at: o.marked ? "x" : null, refund_due: !!o.refund, refunded_at: o.refunded ? "x" : null, supplier_batches: { delivery_date: b.date, status: b.status, suppliers: { name: dSup(b.sid).name } }, supplier_order_lines: dLines(o) }; };
  const wait = v => new Promise(r => setTimeout(() => r(v), 30));
  const fail = m => Promise.reject(new Error(m));
  function sampleLines(sid, i) { const its = D.items.filter(x => x.supplier_id === sid); return [{ item_name: its[i % its.length].name, unit: its[i % its.length].unit, qty: 4 + i }, { item_name: its[(i + 1) % its.length].name, unit: its[(i + 1) % its.length].unit, qty: 2 + i }]; }
  function dStopsFor(b) {
    const own = D.orders.filter(o => o.batch === b.id && ["paid", "confirmed", "packed", "on_the_way", "delivered"].includes(o.status))
      .map(o => ({ order_id: o.id, shop_name: "Your demo shop", shop_phone: "0710000000", area_name: "Geneva", status: o.status, items: dLines(o) }));
    const sample = D.sampleShops.slice(0, Math.max(0, Math.min(4, b.base))).map((s, i) => ({ order_id: -(i + 1), shop_name: s.shop_name, shop_phone: s.phone, area_name: s.area, status: b.status === "delivered" ? "delivered" : (b.pickedUp ? "on_the_way" : "paid"), items: sampleLines(b.sid, i) }));
    return sample.concat(own).sort((x, y) => (x.area_name + x.shop_name).localeCompare(y.area_name + y.shop_name));
  }
  const MOCK = {
    suppliers: () => wait(D.sup.map(s => ({ id: s.id, name: s.name, kind: s.kind }))),
    allSuppliers: () => wait(D.sup.slice()),
    settings: () => wait({ transport_cents: 2500, order_fee_percent: 5, driver_fee_percent: 15 }),
    days: sid => wait(D.batches.filter(b => b.sid === Number(sid)).map(b => {
      const mine = D.orders.filter(o => o.batch === b.id && !["cancelled", "dropped"].includes(o.status)).pop();
      return { delivery_date: b.date, cutoff_at: prevDay(b.date) + "T18:00:00+02:00", is_open: b.status === "open", paid_orders: dPaid(b), min_needed: 10, my_order_id: mine ? mine.id : null, my_order_status: mine ? mine.status : null, my_total_cents: mine ? mine.goods + mine.fee + mine.transport : null };
    })),
    items: sid => wait(D.items.filter(i => i.supplier_id === Number(sid) && i.is_available)),
    usual: () => wait(D.usual || []),
    saveUsual: (ids, rows) => { D.usual = (D.usual || []).filter(u => !ids.includes(u.item_id)).concat(rows.map(r => ({ item_id: r.item_id, qty: r.qty }))); return wait(null); },
    place(sid, date, lines) {
      const b = D.batches.find(x => x.sid === Number(sid) && x.date === date);
      if (!b || b.status !== "open") return fail("Orders for this delivery are closed");
      if (D.orders.some(o => o.batch === b.id && !["cancelled", "dropped"].includes(o.status))) return fail("You already have an order for this delivery. Cancel it first if you want to change it.");
      const ls = lines.map(l => { const it = D.items.find(i => i.id === Number(l.item_id)); return { name: it.name, unit: it.unit, qty: l.qty, price: it.group_price_cents }; });
      const goods = ls.reduce((a, l) => a + l.qty * l.price, 0), id = D.nextOrder++;
      D.orders.push({ id, batch: b.id, status: "placed", marked: false, goods, fee: Math.round(goods * 0.05), transport: 2500, ref: "SUPPLY" + pad5(id), lines: ls });
      return wait(id);
    },
    myOrders: () => wait(D.orders.slice().reverse().map(dOrderRow)),
    markPaid(id) { const o = D.orders.find(x => x.id === Number(id)); if (o) o.marked = true; return wait(null); },
    cancel(id) { const o = D.orders.find(x => x.id === Number(id)); if (o && o.status === "placed" && !o.marked) o.status = "cancelled"; else return fail("You said you have paid. Please contact us to cancel this order."); return wait(null); },
    received(id) {
      const o = D.orders.find(x => x.id === Number(id)); if (!o) return fail("Order not found");
      const b = dBatch(o.batch); if (b.status !== "go") return fail("This order is not out for delivery");
      o.status = "delivered";
      if (!D.orders.some(x => x.batch === b.id && ["paid", "confirmed", "packed", "on_the_way"].includes(x.status))) { b.status = "delivered"; D.runs.filter(r => r.batch === b.id).forEach(r => r.status = "delivered"); }
      return wait(null);
    },
    openRuns: () => wait(D.runs.filter(r => r.status === "open").map(r => { const b = dBatch(r.batch); return { run_id: r.id, supplier_name: dSup(b.sid).name, delivery_date: b.date, shops: dStopsFor(b).length, areas: [...new Set(dStopsFor(b).map(s => s.area_name))].join(", "), payout_cents: r.payout }; })),
    myRuns: () => wait(D.runs.filter(r => r.status !== "open").map(r => { const b = dBatch(r.batch); return { run_id: r.id, supplier_name: dSup(b.sid).name, delivery_date: b.date, status: r.status, shops: dStopsFor(b).length, payout_cents: r.payout, picked_up_at: b.pickedUp ? "x" : null }; })),
    stops(id) { const r = D.runs.find(x => x.id === Number(id)); return wait(r && r.status !== "open" ? dStopsFor(dBatch(r.batch)) : []); },
    accept(id) { const r = D.runs.find(x => x.id === Number(id)); if (!r || r.status !== "open") return fail("Another driver already took this run"); r.status = "accepted"; return wait(null); },
    pickedUp(id) { const r = D.runs.find(x => x.id === Number(id)); const b = dBatch(r.batch); b.pickedUp = true; D.orders.filter(o => o.batch === b.id && ["paid", "confirmed", "packed"].includes(o.status)).forEach(o => o.status = "on_the_way"); return wait(null); },
    pending: () => wait(D.orders.filter(o => o.status === "placed").map(o => { const b = dBatch(o.batch); return { order_id: o.id, payment_ref: o.ref, shop_name: "Your demo shop", shop_phone: "0710000000", supplier_name: dSup(b.sid).name, delivery_date: b.date, total_cents: o.goods + o.fee + o.transport, payment_marked_at: o.marked ? "x" : null, cutoff_at: prevDay(b.date) + "T18:00:00+02:00" }; })),
    confirm(id) { const o = D.orders.find(x => x.id === Number(id)); if (!o || o.status !== "placed") return fail("This order is not waiting for payment"); o.status = "paid"; return wait(null); },
    overview: () => wait(D.batches.filter(b => b.date === D.days[0] || D.orders.some(o => o.batch === b.id)).map(b => {
      const mine = D.orders.filter(o => o.batch === b.id && ["paid", "confirmed", "packed", "on_the_way", "delivered"].includes(o.status));
      const paid = dPaid(b), run = D.runs.find(r => r.batch === b.id);
      return { batch_id: b.id, supplier_name: dSup(b.sid).name, delivery_date: b.date, status: b.status, cutoff_at: prevDay(b.date) + "T18:00:00+02:00", orders_total: paid + 1, orders_paid: paid, min_needed: 10, goods_paid_cents: b.base * 80000 + mine.reduce((a, o) => a + o.goods, 0), order_fees_cents: b.base * 4000 + mine.reduce((a, o) => a + o.fee, 0), transport_pool_cents: paid * 2500, driver_fee_cents: run ? Math.round(paid * 2500 * 0.15) : null, driver_pay_cents: run ? run.payout : null, refunds_due: D.orders.filter(o => o.batch === b.id && o.refund && !o.refunded).length, run_id: run ? run.id : null, run_status: run ? run.status : null, driver_id: null };
    })),
    closeBatch(id) {
      const b = dBatch(id); if (b.status !== "open") return wait(b.status);
      const paid = dPaid(b);
      if (paid >= 10) {
        b.status = "go"; D.orders.filter(o => o.batch === b.id && o.status === "placed").forEach(o => o.status = "dropped");
        const pool = paid * 2500, fee = Math.round(pool * 0.15); D.runs.push({ id: D.nextRun++, batch: b.id, status: "open", payout: pool - fee, fee });
        return wait("go");
      }
      b.status = "cancelled"; D.orders.filter(o => o.batch === b.id && ["placed", "paid"].includes(o.status)).forEach(o => { o.refund = o.status === "paid"; o.status = "cancelled"; });
      return wait("cancelled");
    },
    packing(id) {
      const b = dBatch(id), stops = dStopsFor(b), tot = {};
      stops.forEach(s => s.items.forEach(l => { const k = l.item_name + "|" + l.unit; tot[k] = (tot[k] || 0) + l.qty; }));
      return wait({ supplier: dSup(b.sid).name, delivery_date: b.date, status: b.status,
        totals: Object.keys(tot).sort().map(k => ({ item: k.split("|")[0], unit: k.split("|")[1], qty: tot[k] })),
        orders: stops.map(s => ({ order_id: s.order_id, shop_name: s.shop_name, phone: s.shop_phone, area: s.area_name, status: s.status, lines: s.items.map(l => ({ item: l.item_name, unit: l.unit, qty: l.qty })) })) });
    },
    refunds: () => wait(D.orders.filter(o => o.refund && !o.refunded).map(o => ({ id: o.id, shop_name: "Your demo shop", shop_phone: "0710000000", total_cents: o.goods + o.fee + o.transport, payment_ref: o.ref }))),
    refunded(id) { const o = D.orders.find(x => x.id === Number(id)); if (o) o.refunded = true; return wait(null); },
    payouts: () => wait(D.runs.filter(r => r.status === "delivered" && !r.paidOut).map(r => { const b = dBatch(r.batch); return { id: r.id, payout_cents: r.payout, fee_cents: r.fee, driver_name: "Demo driver", supplier_batches: { delivery_date: b.date, suppliers: { name: dSup(b.sid).name } } }; })),
    markPayout(id) { const r = D.runs.find(x => x.id === Number(id)); if (r) r.paidOut = true; return wait(null); },
    adminItems: sid => wait(D.items.filter(i => i.supplier_id === Number(sid))),
    addItem(o) { D.items.push({ id: D.nextItem++, supplier_id: o.supplier_id, name: o.name, unit: o.unit, normal_price_cents: o.normal_price_cents, group_price_cents: o.group_price_cents, is_available: true }); return wait(null); },
    setItem(id, patch) { Object.assign(D.items.find(i => i.id === Number(id)), patch); return wait(null); }
  };
  const API = () => (SUP.demo ? MOCK : REAL);

  // ---------------------------------------------------------------- loading
  async function loadFor(role) {
    SUP.err = "";
    const a = API();
    if (role === "own") {
      const [sups, set] = await Promise.all([a.suppliers(), a.settings()]);
      SUP.suppliers = sups || []; SUP.settings = set;
      const days = await Promise.all(SUP.suppliers.map(s => a.days(s.id).catch(() => [])));
      SUP.daysBy = {}; SUP.suppliers.forEach((s, i) => SUP.daysBy[s.id] = days[i] || []);
      SUP.orders = await a.myOrders() || [];
      if (SUP.view === "supplier" && SUP.sid) { SUP.items = await a.items(SUP.sid) || []; }
      SUP.usual = await a.usual().catch(() => []) || [];
    } else if (role === "drv") {
      [SUP.open, SUP.mine] = await Promise.all([a.openRuns(), a.myRuns()]);
      SUP.open = SUP.open || []; SUP.mine = SUP.mine || [];
      if (SUP.showStops) SUP.stops[SUP.showStops] = await a.stops(SUP.showStops);
    } else if (role === "adm") {
      const [pend, over, refunds, payouts, sups, set] = await Promise.all([a.pending(), a.overview(), a.refunds(), a.payouts(), a.allSuppliers(), a.settings()]);
      SUP.pend = pend || []; SUP.over = over || []; SUP.refunds = refunds || []; SUP.payouts = payouts || []; SUP.allSup = sups || []; SUP.settings = set;
      if (!SUP.aSid && SUP.allSup[0]) SUP.aSid = SUP.allSup[0].id;
      if (SUP.aSid) SUP.aItems = await a.adminItems(SUP.aSid) || [];
      if (SUP.packBatch) SUP.pack = await a.packing(SUP.packBatch).catch(() => null);
    }
  }
  function curRole() { return SUP.demo ? SUP.demoRole : tab; }
  async function load() {
    SUP.loading = true; render();
    try { await loadFor(curRole()); } catch (e) { SUP.err = e.message; }
    SUP.loading = false; render();
  }
  window.SUPLOAD = load;
  // run an action, then reload what is on screen
  const act = (fn, note) => go(async () => { await fn(); await loadFor(curRole()); if (note) ST.note = note; });

  // ---------------------------------------------------------------- styles
  const css = document.createElement("style");
  css.textContent = `
.spbar{height:10px;border-radius:999px;background:var(--bg);overflow:hidden;margin:8px 0 4px;border:1px solid var(--line)}
.spbar i{display:block;height:100%;background:var(--ok)}
.sprow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0}
.sprow+.sprow{border-top:1px solid var(--line)}
.sprow .nm{flex:1;min-width:0}.sprow .nm small{display:block}
.spold{text-decoration:line-through;color:var(--muted);font-size:13px;margin-right:6px}
.spsum .row{padding:5px 0}
.sppack h3{font-size:15px;margin:12px 0 4px}
.sppack ul{margin:2px 0 8px 18px;padding:0}
.sppack .shop{border-top:1px solid var(--line);padding:8px 0}
.spdemo{border:2px dashed var(--line);background:var(--surface);border-radius:14px;padding:14px;margin-bottom:14px}
.spdemo summary{cursor:pointer;font-weight:800}
.spdemo ol{margin:8px 0 0 18px;padding:0}
.spdemo li{margin:4px 0}
.spchips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}
.spchips button{flex:1 1 120px}
input.spin,select.spin{width:100%;box-sizing:border-box;margin:4px 0 8px;font-size:16px;padding:11px;border-radius:10px}
.spgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
a.btn{display:block;text-align:center;text-decoration:none;box-sizing:border-box}
`;
  document.head.appendChild(css);

  // ---------------------------------------------------------------- owner screens
  const fee = (goods) => Math.round(goods * num(SUP.settings.order_fee_percent) / 100);
  function cartTotals() {
    let goods = 0; SUP.items.forEach(i => { goods += (SUP.cart[i.id] || 0) * i.group_price_cents; });
    const f = fee(goods), t = goods ? num(SUP.settings.transport_cents) : 0;
    return { goods, fee: f, transport: t, total: goods + f + t };
  }
  function bankCard(o) {
    const B = SUP.demo ? { name: "Demo account (not real)", bank: "Demo Bank", acct: "0000000000", branch: "000000" } : BANK;
    if (!B) return '<small>Loading bank details…</small>';
    return `<div class="note"><b>Pay by EFT before orders close</b>
      <div class="row"><span>Amount</span><b>${R(o.total_cents)}</b></div>
      <div class="row"><span>Account name</span><b>${esc(B.name)}</b></div>
      <div class="row"><span>Bank</span><b>${esc(B.bank)}</b></div>
      <div class="row"><span>Account number</span><b>${esc(B.acct)}</b></div>
      ${B.branch ? `<div class="row"><span>Branch code</span><b>${esc(B.branch)}</b></div>` : ""}
      <div class="row"><span>Reference</span><b class="ref">${esc(o.payment_ref)}</b></div>
      Use this exact reference so we can match your payment. Unpaid orders are dropped when orders close.</div>`;
  }
  function orderCard(o) {
    const b = o.supplier_batches || {}, sname = (b.suppliers && b.suppliers.name) || "Supplier";
    let st = STATUS[o.status] || [o.status, ""];
    if (o.status === "cancelled" && o.refund_due) st = ["Cancelled: refund due", "bad"];
    else if (o.status === "cancelled" && o.refunded_at) st = ["Cancelled: refunded", ""];
    let extra = "";
    if (o.status === "placed") {
      extra = bankCard(o) + (o.payment_marked_at
        ? `<div class="note">Thank you. We are checking your payment. Your order shows <b>Paid</b> once we see it in the bank.</div>`
        : `<button class="btn" data-a="sp_paid" data-id="${o.id}">I have paid</button><button class="btn ghost" data-a="sp_cancel" data-id="${o.id}">Cancel this order</button>`);
    } else if (["paid", "confirmed", "packed"].includes(o.status) && b.status === "open") {
      extra = `<div class="note">Your payment is confirmed. The delivery goes ahead once enough shops have paid. We will tell you here.</div>`;
    } else if (["paid", "confirmed", "packed", "on_the_way"].includes(o.status) && b.status === "go") {
      extra = `<div class="note">${o.status === "on_the_way" ? "Your goods are on the way." : "The delivery is on. A driver will bring your goods."}</div><button class="btn" data-a="sp_received" data-id="${o.id}">Received: goods have arrived</button>`;
    } else if (o.status === "cancelled" && o.refund_due) {
      extra = `<div class="note">Not enough shops paid for this delivery day, so it was cancelled. We will refund <b>${R(o.total_cents)}</b>.</div>`;
    } else if (o.status === "dropped") {
      extra = `<div class="note">We did not see your payment before orders closed, so this order was not sent to the supplier.</div>`;
    }
    return `<div class="card"><div class="row"><b>${esc(sname)}</b><span class="tag ${st[1]}">${esc(st[0])}</span></div>
      <div class="row"><span>Delivery</span><b>${esc(fmtDay(b.delivery_date || ""))}</b></div>
      <p style="margin:6px 0">${(o.supplier_order_lines || []).map(l => esc(lineTxt(l))).join("<br>")}</p>
      <div class="row"><span>Total</span><b>${R(o.total_cents)}</b></div>
      <small>Goods ${R(o.goods_cents)} + Eezy Kasi fee ${R(o.fee_cents)} + transport ${R(o.transport_cents)} · ${esc(o.payment_ref || "")}</small>${extra}</div>`;
  }
  function howItWorks() {
    const s = SUP.settings;
    return `<details class="card"><summary><b>How it works</b></summary>
      <ol style="margin:8px 0 0 18px;padding:0"><li>Pick a supplier and a delivery day, and add what you need at the group price.</li>
      <li>Pay by EFT with your order reference, then tap <b>I have paid</b>.</li>
      <li>When at least 10 shops have paid, the delivery goes ahead. A driver brings your goods.</li>
      <li>If fewer than 10 shops pay, the day is cancelled and your money is refunded.</li></ol>
      <div class="note">Eezy Kasi adds a ${num(s.order_fee_percent)}% fee on the goods and ${R(num(s.transport_cents))} for transport. Deliveries are on Tuesday, Thursday and Saturday. Orders close at 18:00 the evening before.</div></details>`;
  }
  function ownerScreen() {
    const waiting = SUP.orders.filter(o => o.status === "placed").length;
    const seg = `<div class="seg" role="tablist">${[["home", "Suppliers"], ["orders", "My orders" + (waiting ? " (" + waiting + ")" : "")]].map(([k, l]) => `<button role="tab" aria-checked="${(SUP.view === k) || (k === "home" && SUP.view === "supplier")}" data-a="sp_view" data-v="${k}">${l}</button>`).join("")}</div>`;
    const err = SUP.err ? `<div class="banner bad">${esc(SUP.err)}</div>` : "";
    const ld = SUP.loading ? '<div class="card"><small>Loading…</small></div>' : "";
    if (SUP.view === "orders") {
      return seg + `<h1>My supply orders</h1><p class="sub">Pay, track and confirm your deliveries.</p>${msgs()}${err}${ld}` +
        (SUP.orders.map(orderCard).join("") || (SUP.loading ? "" : '<div class="card"><small>You have no supply orders yet. Tap Suppliers to start.</small></div>'));
    }
    if (SUP.view === "supplier") return seg + supplierScreen();
    const cards = SUP.suppliers.map(s => {
      const days = SUP.daysBy[s.id] || [], d = days.find(x => x.is_open) || days[0];
      const info = d ? `<div class="row"><span>Next delivery</span><b>${esc(fmtDay(d.delivery_date))}</b></div>
        <small>${d.is_open ? "Orders close " + esc(fmtCut(d.cutoff_at)) : "Orders for this day have closed"}</small>${bar(d.paid_orders, d.min_needed)}
        <small>${d.paid_orders} of ${d.min_needed} shops have paid${d.paid_orders >= d.min_needed ? ": delivery is on" : ""}</small>` : "<small>No delivery days yet.</small>";
      return `<div class="card"><div class="row"><b>${esc(s.name)}</b><span class="tag">${kindLabel(s.kind)}</span></div>${info}<button class="btn" data-a="sp_open" data-id="${s.id}">See prices and order</button></div>`;
    }).join("");
    return seg + `<h1>Supply orders</h1><p class="sub">Order together with other shops for group prices.</p>${msgs()}${err}${howItWorks()}${ld}` +
      (cards || (SUP.loading ? "" : '<div class="card"><small>No suppliers are open yet.</small></div>'));
  }
  function supplierScreen() {
    const s = SUP.suppliers.find(x => x.id === Number(SUP.sid)); if (!s) return "";
    const days = SUP.daysBy[s.id] || [], day = days.find(d => d.delivery_date === SUP.date) || null;
    const dayBtns = days.map(d => `<button role="tab" aria-checked="${SUP.date === d.delivery_date}" data-a="sp_day" data-v="${esc(d.delivery_date)}">${esc(fmtDay(d.delivery_date))}</button>`).join("");
    const t = cartTotals();
    const canOrder = day && day.is_open && !day.my_order_id && t.goods > 0;
    const dayInfo = !day ? "" : `<div class="card"><div class="row"><span>Orders close</span><b>${esc(fmtCut(day.cutoff_at))}</b></div>${bar(day.paid_orders, day.min_needed)}
      <small>${day.paid_orders} of ${day.min_needed} shops have paid${day.paid_orders >= day.min_needed ? ": delivery is on" : ". " + (day.min_needed - day.paid_orders) + " more needed"}</small>
      ${!day.is_open ? '<div class="note">Orders for this day have closed. Choose another day.</div>' : ""}
      ${day.my_order_id ? `<div class="note">You already have an order for this day. Go to <b>My orders</b> to pay or track it.</div>` : ""}</div>`;
    const rows = SUP.items.map(i => `<div class="sprow"><div class="nm"><b>${esc(i.name)}</b><small>${esc(i.unit)}</small></div>
      <div>${i.normal_price_cents ? `<span class="spold">${R(i.normal_price_cents)}</span>` : ""}<b>${R(i.group_price_cents)}</b></div>
      <div class="qty"><button data-a="sp_dec" data-id="${i.id}" aria-label="Less ${esc(i.name)}">−</button><b>${SUP.cart[i.id] || 0}</b><button data-a="sp_inc" data-id="${i.id}" aria-label="More ${esc(i.name)}">+</button></div></div>`).join("");
    const usualHere = SUP.usual.filter(u => SUP.items.some(i => i.id === u.item_id));
    return `<button class="sm" data-a="sp_view" data-v="home">← Suppliers</button><h1 style="margin-top:10px">${esc(s.name)}</h1><p class="sub">Group prices. Choose a delivery day, then your items.</p>${msgs()}
      ${SUP.err ? `<div class="banner bad">${esc(SUP.err)}</div>` : ""}${SUP.loading ? '<div class="card"><small>Loading…</small></div>' : ""}
      <h2>Delivery day</h2><div class="seg" role="tablist">${dayBtns || "<small>No delivery days yet.</small>"}</div>${dayInfo}
      <h2>Your items</h2><div class="card">${rows || "<small>This supplier has not added prices yet. Please check again soon.</small>"}
      ${usualHere.length ? `<button class="btn ghost" data-a="sp_useusual">Use my usual order</button>` : ""}</div>
      <div class="card spsum"><div class="row"><span>Goods</span><b>${R(t.goods)}</b></div>
        <div class="row"><span>Eezy Kasi fee (${num(SUP.settings.order_fee_percent)}%)</span><b>${R(t.fee)}</b></div>
        <div class="row"><span>Transport</span><b>${R(t.transport)}</b></div>
        <div class="row"><span>Total to pay</span><b class="big" style="font-size:30px">${R(t.total)}</b></div>
        <button class="btn" data-a="sp_place" ${canOrder ? "" : "disabled"}>Place order</button>
        <button class="btn ghost" data-a="sp_saveusual" ${t.goods ? "" : "disabled"}>Save as my usual order</button>
        <div class="note">After you place the order you pay by EFT and tap I have paid.</div></div>`;
  }

  // ---------------------------------------------------------------- driver screens
  function driverScreen() {
    const err = SUP.err ? `<div class="banner bad">${esc(SUP.err)}</div>` : "";
    const ld = SUP.loading ? '<div class="card"><small>Loading…</small></div>' : "";
    const open = SUP.open.map(r => `<div class="card"><div class="row"><b>${esc(r.supplier_name)}</b><span class="tag">${esc(fmtDay(r.delivery_date))}</span></div>
      <div class="row"><span>Shops to deliver to</span><b>${r.shops}</b></div><div class="row"><span>Areas</span><b>${esc(r.areas || "")}</b></div>
      <div class="row"><span>Your pay</span><b class="big" style="font-size:28px">${R(r.payout_cents)}</b></div>
      <button class="btn" data-a="sp_accept" data-id="${r.run_id}">Accept this run</button></div>`).join("");
    const mine = SUP.mine.map(r => {
      const stops = SUP.showStops === String(r.run_id) ? (SUP.stops[r.run_id] || []) : null;
      const list = stops ? stops.map(s => `<div class="shop sppack"><div class="row"><b>${esc(s.shop_name)}</b><span class="tag ${s.status === "delivered" ? "ok" : ""}">${esc((STATUS[s.status] || [s.status])[0])}</span></div>
        <small>${esc(s.area_name || "")} · <a href="tel:${esc(s.shop_phone || "")}">${esc(s.shop_phone || "")}</a></small>
        <ul>${(s.items || []).map(l => `<li>${esc(l.qty + " × " + l.item + (l.unit ? " (" + l.unit + ")" : ""))}</li>`).join("")}</ul></div>`).join("") : "";
      return `<div class="card sppack"><div class="row"><b>${esc(r.supplier_name)}</b><span class="tag ${r.status === "delivered" ? "ok" : ""}">${r.status === "delivered" ? "Delivered" : "In progress"}</span></div>
        <div class="row"><span>Delivery day</span><b>${esc(fmtDay(r.delivery_date))}</b></div><div class="row"><span>Shops</span><b>${r.shops}</b></div>
        <div class="row"><span>Your pay</span><b>${R(r.payout_cents)}</b></div>
        <button class="btn ghost" data-a="sp_stops" data-id="${r.run_id}">${stops ? "Hide the shops" : "Show the shops"}</button>${list}
        ${r.status === "accepted" && !r.picked_up_at ? `<button class="btn" data-a="sp_pickedup" data-id="${r.run_id}">I have collected the goods from the supplier</button>` : ""}</div>`;
    }).join("");
    return `<h1>Supply runs</h1><p class="sub">Collect goods from a supplier and deliver to the shops. Shop details show after you accept.</p>${msgs()}${err}${ld}
      <h2>Open runs</h2>${open || '<div class="card"><small>No open runs right now. Tap Refresh to check again.</small></div>'}
      <h2>Your runs</h2>${mine || '<div class="card"><small>You have not accepted a run yet.</small></div>'}`;
  }

  // ---------------------------------------------------------------- admin screens
  function packText(p) {
    let t = `${p.supplier}: delivery ${fmtDay(p.delivery_date)}\n\nTOTAL TO PACK\n` + p.totals.map(x => `${x.qty} x ${x.item} (${x.unit})`).join("\n") + "\n\nBY SHOP\n";
    let area = null;
    p.orders.forEach(o => { if (o.area !== area) { area = o.area; t += `\n${area || "No area"}\n`; } t += `${o.shop_name} ${o.phone || ""}\n` + (o.lines || []).map(l => `  ${l.qty} x ${l.item} (${l.unit})`).join("\n") + "\n"; });
    return t;
  }
  function packCard() {
    const p = SUP.pack; if (!p) return "";
    let area = null, shops = "";
    p.orders.forEach(o => {
      if (o.area !== area) { area = o.area; shops += `<h3>${esc(area || "No area")}</h3>`; }
      shops += `<div class="shop"><b>${esc(o.shop_name)}</b> <small>${esc(o.phone || "")}</small><ul>${(o.lines || []).map(l => `<li>${esc(l.qty + " × " + l.item + " (" + l.unit + ")")}</li>`).join("")}</ul></div>`;
    });
    const txt = packText(p);
    return `<div class="card sppack"><h2>Packing list: ${esc(p.supplier)} · ${esc(fmtDay(p.delivery_date))}</h2><small>Only paid orders. Send this to the supplier.</small>
      <h3>Total to pack</h3><ul>${p.totals.map(x => `<li>${esc(x.qty + " × " + x.item + " (" + x.unit + ")")}</li>`).join("") || "<li>Nothing paid yet</li>"}</ul>
      <h3 style="margin-top:12px">By shop</h3>${shops || "<small>No paid orders yet.</small>"}
      <div class="spgrid" style="margin-top:10px"><button class="btn ghost" data-a="sp_copy">Copy list</button>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(txt)}">Send by WhatsApp</a></div></div>`;
  }
  function adminScreen() {
    const todo = SUP.pend.length + SUP.refunds.length + SUP.payouts.length;
    const seg = `<div class="seg" role="tablist">${[["todo", "To do" + (todo ? " (" + todo + ")" : "")], ["days", "Delivery days"], ["prices", "Prices"]].map(([k, l]) => `<button role="tab" aria-checked="${SUP.atab === k}" data-a="sp_atab" data-v="${k}">${l}</button>`).join("")}</div>`;
    const err = SUP.err ? `<div class="banner bad">${esc(SUP.err)}</div>` : "";
    const ld = SUP.loading ? '<div class="card"><small>Loading…</small></div>' : "";
    let body = "";
    if (SUP.atab === "todo") {
      body = `<h2>Payments to check</h2>` + (SUP.pend.map(p => `<div class="card"><div class="row"><b>${esc(p.shop_name)}</b><span class="tag ${p.payment_marked_at ? "ok" : ""}">${p.payment_marked_at ? "Says paid" : "Not marked"}</span></div>
        <div class="row"><span>Reference</span><b class="ref">${esc(p.payment_ref)}</b></div><div class="row"><span>Amount</span><b>${R(p.total_cents)}</b></div>
        <small>${esc(p.supplier_name)} · ${esc(fmtDay(p.delivery_date))} · ${esc(p.shop_phone || "")}</small>
        <button class="btn" data-a="sp_confirm" data-id="${p.order_id}">Payment received in the bank</button></div>`).join("") || '<div class="card"><small>No payments waiting.</small></div>')
        + `<h2>Refunds to pay</h2>` + (SUP.refunds.map(r => `<div class="card"><div class="row"><b>${esc(r.shop_name)}</b><b>${R(r.total_cents)}</b></div><small>${esc(r.payment_ref || "")} · ${esc(r.shop_phone || "")}</small>
        <button class="btn" data-a="sp_refunded" data-id="${r.id}">I have refunded this shop</button></div>`).join("") || '<div class="card"><small>No refunds due.</small></div>')
        + `<h2>Drivers to pay</h2>` + (SUP.payouts.map(r => { const b = r.supplier_batches || {}; return `<div class="card"><div class="row"><b>${esc(r.driver_name)}</b><b>${R(r.payout_cents)}</b></div>
        <small>${esc((b.suppliers && b.suppliers.name) || "")} · ${esc(fmtDay(b.delivery_date || ""))} · your 15% fee ${R(r.fee_cents || 0)}</small>
        <button class="btn" data-a="sp_payout" data-id="${r.id}">I have paid the driver</button></div>`; }).join("") || '<div class="card"><small>No drivers waiting for payment.</small></div>');
    } else if (SUP.atab === "days") {
      body = `<h2>Delivery days</h2><small>A day closes by itself 2 hours after orders close. You can also close it earlier.</small>` + (SUP.over.map(o => {
        const st = BSTATUS[o.status] || [o.status, ""];
        return `<div class="card"><div class="row"><b>${esc(o.supplier_name)}</b><span class="tag ${st[1]}">${esc(st[0])}</span></div>
        <div class="row"><span>Delivery</span><b>${esc(fmtDay(o.delivery_date))}</b></div>${bar(o.orders_paid, o.min_needed)}<small>${o.orders_paid} of ${o.min_needed} shops paid</small>
        <div class="row"><span>Goods paid</span><b>${R(num(o.goods_paid_cents))}</b></div><div class="row"><span>Shop fees (yours)</span><b>${R(num(o.order_fees_cents))}</b></div>
        <div class="row"><span>Transport money</span><b>${R(num(o.transport_pool_cents))}</b></div>
        ${o.run_id ? `<div class="row"><span>Driver run</span><b>${esc(o.run_status)} · driver gets ${R(num(o.driver_pay_cents))}</b></div>` : ""}
        ${o.refunds_due ? `<div class="banner bad" style="margin-top:8px">${o.refunds_due} refund(s) due</div>` : ""}
        <div class="spgrid" style="margin-top:8px"><button class="btn ghost" data-a="sp_pack" data-id="${o.batch_id}">${SUP.packBatch === String(o.batch_id) ? "Hide" : "Packing list"}</button>
        ${o.status === "open" ? `<button class="btn" data-a="sp_close" data-id="${o.batch_id}">Close this day</button>` : ""}</div></div>${SUP.packBatch === String(o.batch_id) ? packCard() : ""}`;
      }).join("") || '<div class="card"><small>No delivery days yet. They appear when the first shop orders.</small></div>');
    } else {
      const sel = `<select class="spin" data-a="sp_asup" aria-label="Supplier">${SUP.allSup.map(s => `<option value="${s.id}" ${Number(SUP.aSid) === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`;
      const rows = SUP.aItems.map(i => `<div class="sprow"><div class="nm"><b>${esc(i.name)}</b><small>${esc(i.unit)}${i.is_available ? "" : " · hidden"}</small></div>
        <div>Group R <input type="number" min="0" step="0.5" style="width:90px" value="${i.group_price_cents / 100}" data-a="sp_price" data-id="${i.id}" aria-label="Group price for ${esc(i.name)}"></div>
        <button class="sm" data-a="sp_toggle" data-id="${i.id}" data-v="${i.is_available ? "0" : "1"}">${i.is_available ? "Hide" : "Show"}</button></div>`).join("");
      const f = ST.form || {};
      body = `<h2>Supplier prices</h2><small>Suppliers do not log in yet. Enter the group prices they send you.</small>${sel}
        <div class="card">${rows || "<small>No items yet.</small>"}</div>
        <h2>Add an item</h2><div class="card"><input class="spin" type="text" placeholder="Item name, for example White bread" data-a="form" data-k="sp_name" value="${esc(f.sp_name || "")}">
        <input class="spin" type="text" placeholder="Unit: loaf, bag, box, kg" data-a="form" data-k="sp_unit" value="${esc(f.sp_unit || "")}">
        <input class="spin" type="number" min="0" step="0.5" placeholder="Group price in rand" data-a="form" data-k="sp_group" value="${esc(f.sp_group || "")}">
        <input class="spin" type="number" min="0" step="0.5" placeholder="Normal shop price in rand (optional)" data-a="form" data-k="sp_normal" value="${esc(f.sp_normal || "")}">
        <button class="btn" data-a="sp_additem">Add item</button></div>`;
    }
    return seg + `<h1>Supply orders</h1><p class="sub">Payments, delivery days and supplier prices.</p>${msgs()}${err}${ld}${body}`;
  }

  // ---------------------------------------------------------------- demo shell (no login needed)
  function supplierViewScreen() {
    const b = SUP.over[0];
    return `<h1>What the supplier receives</h1><p class="sub">Suppliers see only orders that are already paid, grouped by area, with the shop name and phone number.</p>${msgs()}
      ${SUP.over.map(o => `<button class="btn ghost" data-a="sp_pack" data-id="${o.batch_id}">${esc(o.supplier_name)} · ${esc(fmtDay(o.delivery_date))}</button>`).join("")}
      ${SUP.packBatch ? packCard() : '<div class="card"><small>Choose a delivery day above to see the packing list.</small></div>'}`;
  }
  function demoShell() {
    const roles = [["own", "Shop owner"], ["drv", "Driver"], ["adm", "Eezy Kasi admin"], ["sup", "Supplier"]];
    const chips = `<div class="spchips" role="tablist">${roles.map(([k, l]) => `<button role="tab" aria-checked="${SUP.demoRole === k}" data-a="sp_role" data-v="${k}" class="sm">${l}</button>`).join("")}</div>`;
    let screen = "";
    if (SUP.demoRole === "own") screen = ownerScreen();
    else if (SUP.demoRole === "drv") screen = driverScreen();
    else if (SUP.demoRole === "adm") screen = adminScreen();
    else screen = supplierViewScreen();
    return `<h1>Supply orders: demo</h1><p class="sub">Try the whole process with sample data. Nothing here is real and no money moves.</p>
      <details class="spdemo" ${D && D.orders.length ? "" : "open"}><summary>Try it in 7 steps</summary><ol>
      <li><b>Shop owner:</b> open Sample Wholesale, choose the first delivery day, add items and place the order.</li>
      <li>Tap <b>My orders</b>, then <b>I have paid</b>.</li>
      <li><b>Eezy Kasi admin:</b> tap <b>Payment received in the bank</b>. You are the 10th paying shop.</li>
      <li>Admin: open <b>Delivery days</b> and tap <b>Close this day</b>. The delivery goes ahead.</li>
      <li><b>Driver:</b> accept the run, see the shops and tap that you collected the goods.</li>
      <li><b>Shop owner:</b> tap <b>Received</b>.</li>
      <li><b>Supplier:</b> see the packing list, only paid orders, grouped by area.</li></ol>
      <button class="sm" data-a="sp_reset" style="margin-top:8px">Start the demo again</button> <button class="sm" data-a="sp_exit">Close the demo</button></details>${chips}${screen}`;
  }
  function demoOn() {
    SUP.demo = true; D = D || mkDemo(); SUP.view = "home"; SUP.cart = {}; SUP.sid = null; SUP.date = null;
    SUP.demoRole = SUP.demoRole === "sup" ? "own" : SUP.demoRole;
    return load();
  }

  // ---------------------------------------------------------------- hook into the app
  const isSupplyUser = () => !!(user && (tab === "own" || tab === "adm" || (tab === "drv" && ST.me && ST.me.status === "approved" && ST.me.vehicle_type && ST.me.vehicle_type !== "car")));

  const _msgTabs = window.msgTabs;
  window.msgTabs = function () {
    const h = _msgTabs.apply(this, arguments);
    if (!isSupplyUser()) return h;
    const b = `<button role="tab" aria-checked="${xtab === "supply"}" data-a="xtab" data-v="supply">Supply</button>`;
    return h.replace(/<button role="tab"[^>]*data-v="msgs"/, b + "$&");
  };
  const wrapScreen = (name, fn) => { const orig = window[name]; window[name] = function () { return xtab === "supply" ? fn() : orig.apply(this, arguments); }; };
  wrapScreen("owner", ownerScreen); wrapScreen("driver", driverScreen); wrapScreen("admin", adminScreen);

  const _xtab = H.xtab;
  H.xtab = function (el) {
    const r = _xtab.apply(this, arguments), v = el.dataset.v;
    if (v === "supply") { return Promise.resolve(r).then(() => load()); }
    return r;
  };
  const _refresh = H.refresh;
  H.refresh = function () {
    if (!SUP.demo && xtab === "supply" && user) return go(async () => { await loadFor(tab); });
    return _refresh.apply(this, arguments);
  };

  const _login = window.loginScreen;
  window.loginScreen = function () { return SUP.demo ? demoShell() : _login.apply(this, arguments); };
  const _render = window.render;
  window.render = function () {
    if (SUP.demo) {
      const bar = document.getElementById("bar"); if (bar) bar.innerHTML = "";
      document.getElementById("app").innerHTML = demoShell(); window.scrollTo && 0;
      return;
    }
    return _render.apply(this, arguments);
  };

  // ---------------------------------------------------------------- buttons
  const val = el => el.dataset.id;
  Object.assign(H, {
    sp_view: el => { SUP.view = el.dataset.v; SUP.err = ""; if (SUP.view === "orders" || SUP.view === "home") return Promise.resolve(load()); },
    sp_open: el => { SUP.sid = Number(val(el)); SUP.view = "supplier"; SUP.cart = {}; SUP.date = null; SUP.items = []; SUP.err = "";
      return go(async () => { SUP.items = await API().items(SUP.sid) || []; const d = (SUP.daysBy[SUP.sid] || []).find(x => x.is_open && !x.my_order_id) || (SUP.daysBy[SUP.sid] || [])[0]; SUP.date = d ? d.delivery_date : null; }); },
    sp_day: el => { SUP.date = el.dataset.v; },
    sp_inc: el => { const k = Number(val(el)); SUP.cart[k] = Math.min(500, (SUP.cart[k] || 0) + 1); },
    sp_dec: el => { const k = Number(val(el)); SUP.cart[k] = Math.max(0, (SUP.cart[k] || 0) - 1); if (!SUP.cart[k]) delete SUP.cart[k]; },
    sp_useusual: () => { SUP.usual.forEach(u => { if (SUP.items.some(i => i.id === u.item_id)) SUP.cart[u.item_id] = u.qty; }); },
    sp_saveusual: () => go(async () => { const ids = SUP.items.map(i => i.id), rows = Object.keys(SUP.cart).map(k => ({ item_id: Number(k), qty: SUP.cart[k] })); await API().saveUsual(ids, rows); SUP.usual = await API().usual() || []; ST.note = "Saved. Next time tap Use my usual order."; }),
    sp_place: () => go(async () => {
      const lines = Object.keys(SUP.cart).map(k => ({ item_id: Number(k), qty: SUP.cart[k] }));
      await API().place(SUP.sid, SUP.date, lines); SUP.cart = {}; SUP.view = "orders";
      await loadFor(curRole()); ST.note = "Order placed. Now pay by EFT with the reference below, then tap I have paid.";
    }),
    sp_paid: el => act(() => API().markPaid(val(el)), "Thank you. We will check your payment."),
    sp_cancel: el => { if (!confirm("Cancel this order?")) return; return act(() => API().cancel(val(el)), "Order cancelled."); },
    sp_received: el => act(() => API().received(val(el)), "Thank you. Delivery confirmed."),
    // driver
    sp_accept: el => act(() => API().accept(val(el)), "Run accepted. Open Your runs to see the shops."),
    sp_stops: el => go(async () => { const id = String(val(el)); if (SUP.showStops === id) { SUP.showStops = null; return; } SUP.showStops = id; SUP.stops[id] = await API().stops(id) || []; }),
    sp_pickedup: el => act(() => API().pickedUp(val(el)), "Thank you. Now deliver to each shop."),
    // admin
    sp_atab: el => { SUP.atab = el.dataset.v; SUP.err = ""; },
    sp_confirm: el => act(() => API().confirm(val(el)), "Payment confirmed."),
    sp_refunded: el => act(() => API().refunded(val(el)), "Refund recorded."),
    sp_payout: el => act(() => API().markPayout(val(el)), "Driver payment recorded."),
    sp_close: el => { if (!confirm("Close this delivery day now?")) return; return go(async () => { const r = await API().closeBatch(val(el)); await loadFor(curRole()); ST.note = r === "go" ? "Closed: the delivery is on and a run is open for drivers." : r === "cancelled" ? "Closed: not enough shops paid, so the day is cancelled. Refunds are listed under To do." : "This day was already closed."; }); },
    sp_pack: el => go(async () => { const id = String(val(el)); if (SUP.packBatch === id && curRole() === "adm") { SUP.packBatch = null; SUP.pack = null; return; } SUP.packBatch = id; SUP.pack = await API().packing(id); }),
    sp_copy: () => { const t = SUP.pack ? packText(SUP.pack) : ""; try { navigator.clipboard.writeText(t).then(() => { ST.note = "Copied. Paste it into a message."; render(); }, () => prompt("Copy this list:", t)); } catch (e) { prompt("Copy this list:", t); } return Promise.resolve(); },
    sp_asup: el => go(async () => { SUP.aSid = Number(el.value); SUP.aItems = await API().adminItems(SUP.aSid) || []; }),
    sp_toggle: el => act(() => API().setItem(val(el), { is_available: el.dataset.v === "1" }), "Saved."),
    sp_additem: () => go(async () => {
      const f = ST.form, name = (f.sp_name || "").trim(), unit = (f.sp_unit || "").trim() || "each", g = Math.round(parseFloat(f.sp_group) * 100), n = f.sp_normal ? Math.round(parseFloat(f.sp_normal) * 100) : null;
      if (!name) throw new Error("Type the item name."); if (!(g >= 0)) throw new Error("Type the group price in rand.");
      await API().addItem({ supplier_id: Number(SUP.aSid), name, unit, group_price_cents: g, normal_price_cents: n });
      f.sp_name = f.sp_unit = f.sp_group = f.sp_normal = ""; await loadFor(curRole()); ST.note = "Item added.";
    }),
    // demo
    sp_role: el => { SUP.demoRole = el.dataset.v; SUP.err = ""; SUP.view = "home"; SUP.packBatch = null; SUP.pack = null; return Promise.resolve(load()); },
    sp_reset: () => { D = mkDemo(); SUP.demoRole = "own"; SUP.cart = {}; SUP.view = "home"; SUP.packBatch = null; SUP.pack = null; return Promise.resolve(demoOn()); },
    sp_exit: () => { SUP.demo = false; try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { location.hash = ""; } window.render(); }
  });

  // group price edits (admin) happen on "change"
  document.body.addEventListener("change", e => {
    const t = e.target; if (!t || !t.dataset) return;
    if (t.dataset.a === "sp_price") { const v = Math.round(parseFloat(t.value) * 100); if (v >= 0) act(() => API().setItem(t.dataset.id, { group_price_cents: v }), "Price saved."); }
    else if (t.dataset.a === "sp_asup") { H.sp_asup(t); }
  });

  // ---------------------------------------------------------------- start: open the demo when the address ends with #supply-demo
  const wantsDemo = () => /supply-demo/i.test(location.hash || "");
  window.addEventListener("hashchange", () => { if (wantsDemo()) demoOn(); });
  if (wantsDemo()) demoOn();
})();
