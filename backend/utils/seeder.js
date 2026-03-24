/**
 * GCSC Demo Data Seeder
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates 5 realistic sample shipments in the database so you have something
 * to look at immediately after setup.
 *
 * Usage:
 *   node utils/seeder.js          # seed demo shipments
 *   node utils/seeder.js --clear  # delete ALL shipments
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose   = require('mongoose');
const Shipment   = require('../models/Shipment');
const generateTracking = require('./generateTracking');

const DEMO_SHIPMENTS = [
  {
    status: 'In Transit',
    sender: {
      name: 'TechFlow Industries', email: 'ops@techflow.com', phone: '+1-312-555-0100',
      address: '500 W Madison St', city: 'Chicago', country: 'United States',
    },
    receiver: {
      name: 'Nexus Europe Ltd', email: 'receiving@nexuseu.com', phone: '+44-20-7946-0100',
      address: '10 Downing Lane', city: 'London', country: 'United Kingdom',
    },
    packageInfo: { description: 'Industrial electronics', weight: '84 kg', dimensions: '120×80×60 cm', quantity: 3 },
    service: 'Air Freight',
    origin: 'Chicago, USA',
    destination: 'London, UK',
    currentLocation: { name: 'London Heathrow Airport', lat: 51.4700, lng: -0.4543 },
    estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    adminNotes: 'High-value consignment — handle with care.',
    timeline: [
      { status: 'Pending',    location: 'Chicago, USA',              description: 'Shipment registered in GCSC system.', timestamp: new Date(Date.now() - 5 * 86400000) },
      { status: 'Processing', location: 'GCSC Chicago Hub',          description: 'Shipment collected and checked in at origin hub.', timestamp: new Date(Date.now() - 4 * 86400000) },
      { status: 'In Transit', location: 'O\'Hare International Airport', description: 'Departed on AA flight AA6312 to London Heathrow.', timestamp: new Date(Date.now() - 3 * 86400000) },
      { status: 'In Transit', location: 'London Heathrow Airport',   description: 'Arrived at destination airport. Customs clearance underway.', timestamp: new Date(Date.now() - 86400000) },
    ],
  },
  {
    status: 'Delivered',
    sender: {
      name: 'Pacific Rim Imports', email: 'dispatch@pacificrim.com', phone: '+1-213-555-0200',
      address: '1000 South Figueroa St', city: 'Los Angeles', country: 'United States',
    },
    receiver: {
      name: 'Yamamoto Corp', email: 'logistics@yamamoto.jp', phone: '+81-3-5555-0200',
      address: '2-1 Marunouchi', city: 'Tokyo', country: 'Japan',
    },
    packageInfo: { description: 'Automotive parts', weight: '210 kg', dimensions: '180×90×90 cm', quantity: 6 },
    service: 'Ocean Freight (FCL)',
    origin: 'Los Angeles, USA',
    destination: 'Tokyo, Japan',
    currentLocation: { name: 'Port of Tokyo', lat: 35.6195, lng: 139.7826 },
    estimatedDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    timeline: [
      { status: 'Pending',    location: 'Los Angeles, USA',  description: 'Shipment registered.', timestamp: new Date(Date.now() - 20 * 86400000) },
      { status: 'In Transit', location: 'Port of Long Beach', description: 'Container loaded on vessel MSC Stellanova. ETD 14:00 local time.', timestamp: new Date(Date.now() - 18 * 86400000) },
      { status: 'In Transit', location: 'Pacific Ocean',      description: 'Vessel departed — estimated 14 days transit.', timestamp: new Date(Date.now() - 17 * 86400000) },
      { status: 'In Transit', location: 'Port of Tokyo',      description: 'Vessel arrived. Customs examination in progress.', timestamp: new Date(Date.now() - 2 * 86400000) },
      { status: 'Out for Delivery', location: 'Tokyo Distribution Hub', description: 'Cleared customs. Out for final delivery.', timestamp: new Date(Date.now() - 86400000) },
      { status: 'Delivered',  location: 'Tokyo, Japan',       description: 'Delivered and signed for by T. Yamamoto.', timestamp: new Date(Date.now() - 3600000) },
    ],
  },
  {
    status: 'Out for Delivery',
    sender: {
      name: 'Hartley Manufacturing', email: 'shipping@hartley.com', phone: '+1-214-555-0300',
      address: '3500 Commerce Dr', city: 'Dallas', country: 'United States',
    },
    receiver: {
      name: 'Al Farsi Trading LLC', email: 'info@alfarsi.ae', phone: '+971-4-555-0300',
      address: 'Dubai Logistics City, Zone B', city: 'Dubai', country: 'UAE',
    },
    packageInfo: { description: 'Steel machinery components', weight: '340 kg', dimensions: '200×100×80 cm', quantity: 2 },
    service: 'Air Freight Express',
    origin: 'Dallas, USA',
    destination: 'Dubai, UAE',
    currentLocation: { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 },
    estimatedDelivery: new Date(Date.now() + 4 * 60 * 60 * 1000),
    timeline: [
      { status: 'Pending',          location: 'Dallas, USA',          description: 'Shipment registered.', timestamp: new Date(Date.now() - 3 * 86400000) },
      { status: 'In Transit',       location: 'DFW Airport',           description: 'Loaded on Emirates Air Cargo EK9965.', timestamp: new Date(Date.now() - 2 * 86400000) },
      { status: 'In Transit',       location: 'Dubai International Airport', description: 'Arrived DXB — customs cleared.', timestamp: new Date(Date.now() - 86400000) },
      { status: 'Out for Delivery', location: 'Dubai, UAE',            description: 'Driver en route to delivery address.', timestamp: new Date(Date.now() - 2 * 3600000) },
    ],
  },
  {
    status: 'Exception',
    sender: {
      name: 'MedEquip Solutions', email: 'export@medequip.com', phone: '+1-713-555-0400',
      address: '8888 Katy Freeway', city: 'Houston', country: 'United States',
    },
    receiver: {
      name: 'Lagos University Hospital', email: 'procurement@luth.ng', phone: '+234-1-555-0400',
      address: 'Idi-Araba', city: 'Lagos', country: 'Nigeria',
    },
    packageInfo: { description: 'Medical imaging equipment', weight: '95 kg', dimensions: '90×70×70 cm', quantity: 1 },
    service: 'Air Freight',
    origin: 'Houston, USA',
    destination: 'Lagos, Nigeria',
    currentLocation: { name: 'Murtala Muhammed Airport, Lagos', lat: 6.5774, lng: 3.3214 },
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    adminNotes: 'Customs hold — additional documentation required. Contact receiver.',
    timeline: [
      { status: 'Pending',    location: 'Houston, USA',                  description: 'Shipment registered.', timestamp: new Date(Date.now() - 6 * 86400000) },
      { status: 'In Transit', location: 'George Bush Intercontinental Airport', description: 'Dispatched on UA8821 to Lagos via Amsterdam.', timestamp: new Date(Date.now() - 5 * 86400000) },
      { status: 'In Transit', location: 'Schiphol Airport, Amsterdam',   description: 'Transiting Amsterdam.', timestamp: new Date(Date.now() - 4 * 86400000) },
      { status: 'In Transit', location: 'Murtala Muhammed Airport, Lagos', description: 'Arrived Lagos.', timestamp: new Date(Date.now() - 2 * 86400000) },
      { status: 'Exception',  location: 'Murtala Muhammed Airport, Lagos', description: 'Customs hold — Form M documentation requested. GCSC agent working with NCS.', timestamp: new Date(Date.now() - 86400000) },
    ],
  },
  {
    status: 'Pending',
    sender: {
      name: 'Sofia M.', email: 'sofia.m@email.com', phone: '+1-617-555-0500',
      address: '25 Commonwealth Ave', city: 'Boston', country: 'United States',
    },
    receiver: {
      name: 'Katerina M.', email: 'katerina@email.co.uk', phone: '+44-20-7946-0500',
      address: '14 Baker Street', city: 'London', country: 'United Kingdom',
    },
    packageInfo: { description: 'Personal documents & gifts', weight: '4 kg', dimensions: '40×30×20 cm', quantity: 1 },
    service: 'Express Parcel',
    origin: 'Boston, USA',
    destination: 'London, UK',
    currentLocation: { name: 'GCSC Boston Processing Centre', lat: 42.3601, lng: -71.0589 },
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    timeline: [
      { status: 'Pending', location: 'Boston, USA', description: 'Parcel received at GCSC drop-off point. Awaiting collection scan.', timestamp: new Date() },
    ],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('✅ MongoDB connected');

    if (process.argv.includes('--clear')) {
      await Shipment.deleteMany({});
      console.log('🗑️  All shipments deleted.');
      process.exit(0);
    }

    let created = 0;
    for (const demo of DEMO_SHIPMENTS) {
      demo.trackingNumber = generateTracking();
      await Shipment.create(demo);
      console.log(`  ✓ Created ${demo.trackingNumber} — ${demo.sender.name} → ${demo.receiver.name}`);
      created++;
    }

    console.log(`\n✅ Seeded ${created} demo shipments successfully.`);
    console.log('   Open your admin dashboard to view them.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeder failed:', err.message);
    process.exit(1);
  }
}

seed();
