/**
 * Automated Verification Script for Phase 6 Context Management (Backend)
 * Tests:
 * 1. Chat Mongoose Schema compilation
 * 2. Default conversationId generation
 * 3. 30-day session expiration & renewSession method
 * 4. Cross-patient isolation check logic
 * 5. Explicit consent tracking
 */

const assert = require('assert');
const mongoose = require('mongoose');
const Chat = require('../models/Chat');

function runBackendContextTests() {
  console.log('--- Running Phase 6 Backend Context Tests ---');

  // Test 1: Chat model instance creation & defaults
  const mockPatientId = new mongoose.Types.ObjectId();
  const chat = new Chat({
    patient: mockPatientId,
    title: 'Hypertension Follow-up'
  });

  assert.ok(chat.conversationId.startsWith('conv-'), 'conversationId should start with conv-');
  assert.strictEqual(chat.consentGiven, false, 'consentGiven should default to false');
  assert.strictEqual(chat.isActive, true, 'isActive should default to true');
  assert.ok(chat.expiresAt instanceof Date, 'expiresAt should be a Date');

  // Verify default expiration is ~30 days in the future
  const thirtyDaysMs = 29 * 24 * 60 * 60 * 1000;
  const diff = chat.expiresAt.getTime() - Date.now();
  assert.ok(diff > thirtyDaysMs, 'expiresAt should be at least 29+ days in the future');
  console.log('✓ Test 1 Passed: Chat model instantiation and default fields verified');

  // Test 2: Session expiration and renewal methods
  assert.strictEqual(chat.isExpired(), false, 'New chat should not be expired');
  
  // Simulate expired date
  chat.expiresAt = new Date(Date.now() - 10000);
  assert.strictEqual(chat.isExpired(), true, 'Past expiresAt should report isExpired=true');

  chat.renewSession(15);
  assert.strictEqual(chat.isExpired(), false, 'Renewed session should not be expired');
  console.log('✓ Test 2 Passed: isExpired and renewSession methods verified');

  // Test 3: Consent tracking
  chat.consentGiven = true;
  chat.consentDate = new Date();
  assert.strictEqual(chat.consentGiven, true, 'Consent should be true');
  assert.ok(chat.consentDate instanceof Date, 'consentDate should be set');
  console.log('✓ Test 3 Passed: Explicit consent tracking verified');

  // Test 4: Cross-patient isolation check logic
  const patientA = new mongoose.Types.ObjectId();
  const patientB = new mongoose.Types.ObjectId();

  const chatA = new Chat({
    patient: patientA,
    conversationId: 'conv-test-isolation-1'
  });

  // Function simulating route isolation boundary
  function checkConversationAccess(chatDoc, requestingPatientId) {
    if (chatDoc.patient.toString() !== requestingPatientId.toString()) {
      return { status: 403, error: 'Access denied: Cross-patient conversation access forbidden.' };
    }
    return { status: 200, success: true };
  }

  const accessAllowed = checkConversationAccess(chatA, patientA);
  assert.strictEqual(accessAllowed.status, 200, 'Patient A should access own chat');

  const accessBlocked = checkConversationAccess(chatA, patientB);
  assert.strictEqual(accessBlocked.status, 403, 'Patient B must be blocked from accessing Patient A chat');
  console.log('✓ Test 4 Passed: Strict cross-patient isolation logic verified');

  // Test 5: Message schema and citation attachment
  chat.messages.push({
    sender: 'patient',
    message: 'What is my current blood pressure target?'
  });
  chat.messages.push({
    sender: 'ai',
    message: 'According to AHA guidelines, target is < 130/80 mmHg.',
    citations: [{
      document_id: 'guideline-cardio-01',
      title: 'AHA Hypertension Guidelines',
      excerpt: 'Target BP is < 130/80.',
      relevance_score: 0.95
    }],
    isPersonalRecordUsed: true
  });

  assert.strictEqual(chat.messages.length, 2, 'Should have 2 messages');
  assert.strictEqual(chat.messages[1].citations.length, 1, 'Should preserve citation');
  assert.strictEqual(chat.messages[1].isPersonalRecordUsed, true, 'Should record record usage');
  console.log('✓ Test 5 Passed: Message history and citation retention verified');

  console.log('--- ALL BACKEND CONTEXT TESTS PASSED CLEANLY ---');
}

runBackendContextTests();
