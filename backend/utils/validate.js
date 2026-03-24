/**
 * Input Validation Helpers
 */

/**
 * Validates the body of a create/update shipment request.
 * Returns an array of error strings (empty = valid).
 */
function validateShipment(data) {
  const errors = [];

  // Sender
  if (!data.sender?.name)    errors.push('Sender name is required');
  if (!data.sender?.address) errors.push('Sender address is required');
  if (!data.sender?.city)    errors.push('Sender city is required');
  if (!data.sender?.country) errors.push('Sender country is required');

  // Receiver
  if (!data.receiver?.name)    errors.push('Receiver name is required');
  if (!data.receiver?.address) errors.push('Receiver address is required');
  if (!data.receiver?.city)    errors.push('Receiver city is required');
  if (!data.receiver?.country) errors.push('Receiver country is required');

  // Route
  if (!data.origin)      errors.push('Origin is required');
  if (!data.destination) errors.push('Destination is required');

  return errors;
}

/**
 * Simple email format check.
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { validateShipment, validateEmail };
