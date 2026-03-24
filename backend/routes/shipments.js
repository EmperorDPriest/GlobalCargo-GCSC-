/**
 * Public Shipment Routes
 *
 * GET /api/shipments/track/:trackingNumber
 *   — Public endpoint; no authentication required.
 *   — Returns sanitised shipment data (admin-only fields excluded).
 */

const express  = require('express');
const Shipment = require('../models/Shipment');
const router   = express.Router();

router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber || trackingNumber.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking number format.',
      });
    }

    const shipment = await Shipment.findOne({
      trackingNumber: trackingNumber.trim().toUpperCase(),
      isArchived:     false,
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'No shipment found with that tracking number. Please check and try again.',
      });
    }

    // Return only public-safe fields
    const data = {
      trackingNumber: shipment.trackingNumber,
      status:         shipment.status,
      origin:         shipment.origin,
      destination:    shipment.destination,
      service:        shipment.service,
      sender: {
        name:    shipment.sender.name,
        city:    shipment.sender.city,
        country: shipment.sender.country,
      },
      receiver: {
        name:    shipment.receiver.name,
        city:    shipment.receiver.city,
        country: shipment.receiver.country,
        // Include email/phone only if present (helps recipient confirm)
        ...(shipment.receiver.email && { email: shipment.receiver.email }),
        ...(shipment.receiver.phone && { phone: shipment.receiver.phone }),
      },
      packageInfo:       shipment.packageInfo,
      currentLocation:   shipment.currentLocation,
      estimatedDelivery: shipment.estimatedDelivery,
      timeline: [...shipment.timeline].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      ),
      createdAt:  shipment.createdAt,
      updatedAt:  shipment.updatedAt,
    };

    res.json({ success: true, shipment: data });

  } catch (err) {
    console.error('Track error:', err);
    res.status(500).json({ success: false, message: 'Error retrieving shipment data.' });
  }
});

module.exports = router;
