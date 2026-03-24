/**
 * Admin Routes — All Protected by JWT
 * ─────────────────────────────────────────────────────────────────────────────
 *  GET    /api/admin/shipments/stats/overview   — Dashboard statistics
 *  POST   /api/admin/shipments                  — Create shipment
 *  GET    /api/admin/shipments                  — List all shipments (paginated)
 *  GET    /api/admin/shipments/:id              — Get single shipment
 *  PUT    /api/admin/shipments/:id              — Update shipment details
 *  PATCH  /api/admin/shipments/:id/status       — Update status + auto timeline
 *  PATCH  /api/admin/shipments/:id/location     — Update current GPS location
 *  POST   /api/admin/shipments/:id/timeline     — Add timeline event
 *  DELETE /api/admin/shipments/:id/timeline/:eventId — Remove timeline event
 *  PATCH  /api/admin/shipments/:id/archive      — Toggle archive flag
 *  DELETE /api/admin/shipments/:id              — Permanently delete shipment
 *  GET    /api/admin/stats                      — Alias for overview (legacy)
 */

const express = require('express');
const Shipment = require('../models/Shipment');
const authMiddleware = require('../middleware/auth');
const generateTracking = require('../utils/generateTracking');
const { validateShipment } = require('../utils/validate');
const router = express.Router();

// All routes in this file require a valid JWT
router.use(authMiddleware);

// ── Dashboard stats ───────────────────────────────────────────────────────────
router.get('/shipments/stats/overview', async (req, res) => {
  try {
    const [total, pending, inTransit, delivered, exceptions, onHold] = await Promise.all([
      Shipment.countDocuments({ isArchived: false }),
      Shipment.countDocuments({ status: 'Pending', isArchived: false }),
      Shipment.countDocuments({ status: { $in: ['In Transit', 'Out for Delivery'] }, isArchived: false }),
      Shipment.countDocuments({ status: 'Delivered', isArchived: false }),
      Shipment.countDocuments({ status: 'Exception', isArchived: false }),
      Shipment.countDocuments({ status: 'On Hold', isArchived: false }),
    ]);

    const recent = await Shipment
      .find({ isArchived: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('trackingNumber status origin destination createdAt');

    res.json({
      success: true,
      stats: { total, pending, inTransit, delivered, exceptions, onHold },
      recent,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics.' });
  }
});

// ── Create shipment ───────────────────────────────────────────────────────────
router.post('/shipments', async (req, res) => {
  try {
    const errors = validateShipment(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join(', ') });
    }

    // Generate a unique tracking number (retry on collision)
    let trackingNumber;
    let attempts = 0;
    do {
      trackingNumber = generateTracking();
      attempts++;
      if (attempts > 10) throw new Error('Could not generate unique tracking number');
    } while (await Shipment.findOne({ trackingNumber }));

    const {
      sender, receiver, origin, destination,
      packageInfo, estimatedDelivery, adminNotes,
      service, status, currentLocation,
    } = req.body;

    const initialStatus = status || 'Pending';

    const shipment = await Shipment.create({
      trackingNumber,
      sender,
      receiver,
      origin,
      destination,
      packageInfo,
      service: service || 'Standard',
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : undefined,
      adminNotes,
      status: initialStatus,
      currentLocation: currentLocation ? {
        name: currentLocation.address || currentLocation.name || origin,
        lat: Number(currentLocation.lat) || 0,
        lng: Number(currentLocation.lng) || 0,
      } : { name: origin, lat: 0, lng: 0 },
      timeline: [{
        status: initialStatus,
        location: currentLocation?.address || currentLocation?.name || origin,
        description: 'Shipment created and registered in the GCSC system.',
        timestamp: new Date(),
      }],
    });

    res.status(201).json({
      success: true,
      message: 'Shipment created successfully.',
      shipment,
    });
  } catch (err) {
    console.error('Create shipment error:', err);
    res.status(500).json({ success: false, message: 'Failed to create shipment.' });
  }
});

// ── List shipments (paginated + filterable) ───────────────────────────────────
router.get('/shipments', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, archived } = req.query;

    const query = { isArchived: archived === 'true' };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { trackingNumber: { $regex: search, $options: 'i' } },
        { 'sender.name': { $regex: search, $options: 'i' } },
        { 'receiver.name': { $regex: search, $options: 'i' } },
        { origin: { $regex: search, $options: 'i' } },
        { destination: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Shipment.countDocuments(query);
    const shipments = await Shipment
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit))
      .select('-adminNotes');

    res.json({
      success: true,
      shipments,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (err) {
    console.error('List shipments error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch shipments.' });
  }
});

// ── Get single shipment ───────────────────────────────────────────────────────
router.get('/shipments/:id', async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }
    res.json({ success: true, shipment });
  } catch (err) {
    console.error('Get shipment error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch shipment.' });
  }
});

// ── Update shipment details (sender, receiver, package, etc.) ─────────────────
router.put('/shipments/:id', async (req, res) => {
  try {
    const allowed = [
      'sender', 'receiver', 'origin', 'destination',
      'packageInfo', 'estimatedDelivery', 'adminNotes', 'service',
    ];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const shipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }
    res.json({ success: true, message: 'Shipment updated.', shipment });
  } catch (err) {
    console.error('Update shipment error:', err);
    res.status(500).json({ success: false, message: 'Failed to update shipment.' });
  }
});

// ── Update status (auto-appends timeline entry) ───────────────────────────────
router.patch('/shipments/:id/status', async (req, res) => {
  try {
    const validStatuses = [
      'Pending', 'Processing', 'In Transit', 'Out for Delivery',
      'Delivered', 'Exception', 'On Hold', 'Returned',
    ];
    const { status, description, location } = req.body;

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    shipment.status = status;
    shipment.timeline.push({
      status,
      location: location || shipment.currentLocation.name || shipment.origin,
      description: description || `Status updated to ${status}.`,
      timestamp: new Date(),
    });

    await shipment.save();
    res.json({ success: true, message: 'Status updated.', shipment });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

// ── Update current location ───────────────────────────────────────────────────
router.patch('/shipments/:id/location', async (req, res) => {
  try {
    const { name, lat, lng } = req.body;

    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Location name, lat, and lng are all required.',
      });
    }

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);

    if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates.' });
    }

    const shipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      { currentLocation: { name: name.trim(), lat: parsedLat, lng: parsedLng } },
      { new: true }
    );
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    res.json({ success: true, message: 'Location updated.', shipment });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ success: false, message: 'Failed to update location.' });
  }
});

// ── Add timeline event ────────────────────────────────────────────────────────
router.post('/shipments/:id/timeline', async (req, res) => {
  try {
    const { status, location, description, timestamp } = req.body;

    if (!status || !location || !description) {
      return res.status(400).json({
        success: false,
        message: 'status, location, and description are all required.',
      });
    }

    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    shipment.timeline.push({
      status,
      location: location.trim(),
      description: description.trim(),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    await shipment.save();
    res.json({ success: true, message: 'Timeline event added.', shipment });
  } catch (err) {
    console.error('Add timeline error:', err);
    res.status(500).json({ success: false, message: 'Failed to add timeline event.' });
  }
});

// ── Delete timeline event ─────────────────────────────────────────────────────
router.delete('/shipments/:id/timeline/:eventId', async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    const originalLen = shipment.timeline.length;
    shipment.timeline = shipment.timeline.filter(
      e => e._id.toString() !== req.params.eventId
    );

    if (shipment.timeline.length === originalLen) {
      return res.status(404).json({ success: false, message: 'Timeline event not found.' });
    }

    await shipment.save();
    res.json({ success: true, message: 'Timeline event removed.', shipment });
  } catch (err) {
    console.error('Delete timeline event error:', err);
    res.status(500).json({ success: false, message: 'Failed to remove timeline event.' });
  }
});

// ── Toggle archive ────────────────────────────────────────────────────────────
router.patch('/shipments/:id/archive', async (req, res) => {
  try {
    const existing = await Shipment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }

    const shipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      { isArchived: !existing.isArchived },
      { new: true }
    );

    const action = shipment.isArchived ? 'archived' : 'unarchived';
    res.json({ success: true, message: `Shipment ${action}.`, shipment });
  } catch (err) {
    console.error('Archive error:', err);
    res.status(500).json({ success: false, message: 'Failed to update archive status.' });
  }
});

// ── Permanently delete ────────────────────────────────────────────────────────
router.delete('/shipments/:id', async (req, res) => {
  try {
    const shipment = await Shipment.findByIdAndDelete(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found.' });
    }
    res.json({ success: true, message: 'Shipment permanently deleted.' });
  } catch (err) {
    console.error('Delete shipment error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete shipment.' });
  }
});

// ── Legacy alias ──────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  res.redirect(307, '/api/admin/shipments/stats/overview');
});

module.exports = router;
