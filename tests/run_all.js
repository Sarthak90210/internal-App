const { testStores } = require('./test_stores');
const { testServices } = require('./test_services');
const { testScreensNavigation } = require('./test_screens_navigation');
const { testQrTags } = require('./test_qr_tags');

async function runAllTests() {
  console.log('====================================================');
  console.log(' TEAM ROTOR FPV APP - AUTOMATED TEST SUITE RUNNER');
  console.log(' Expo SDK v57 & React Native Environment Verification');
  console.log('====================================================');

  const startTime = Date.now();

  const storeResults = await testStores();
  const serviceResults = await testServices();
  const screenNavResults = await testScreensNavigation();
  const qrTagResults = await testQrTags();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalPassed = storeResults.passed + serviceResults.passed + screenNavResults.passed + qrTagResults.passed;
  const totalFailed = storeResults.failed + serviceResults.failed + screenNavResults.failed + qrTagResults.failed;
  const totalTests = totalPassed + totalFailed;

  console.log('\n====================================================');
  console.log(' SUMMARY OF TEST SUITE EXECUTION RESULTS');
  console.log('====================================================');
  console.log(`Total Test Suites Executed : 4`);
  console.log(`Total Tests Run            : ${totalTests}`);
  console.log(`Passed Tests               : ${totalPassed}`);
  console.log(`Failed Tests               : ${totalFailed}`);
  console.log(`Execution Time             : ${duration} seconds`);
  console.log('----------------------------------------------------');
  console.log(' Breakdown by Target Suite:');
  console.log(`  1. Core Stores             : ${storeResults.passed} Passed, ${storeResults.failed} Failed`);
  console.log(`  2. Core Services           : ${serviceResults.passed} Passed, ${serviceResults.failed} Failed`);
  console.log(`  3. Screens & Navigation    : ${screenNavResults.passed} Passed, ${screenNavResults.failed} Failed`);
  console.log(`  4. QR Asset Tags & Custody : ${qrTagResults.passed} Passed, ${qrTagResults.failed} Failed`);
  console.log('====================================================\n');

  if (totalFailed > 0) {
    console.log('FAILURES & DETECTED CODE DEFECTS:');
    const allErrors = [...storeResults.errors, ...serviceResults.errors, ...screenNavResults.errors, ...qrTagResults.errors];
    allErrors.forEach((err, idx) => {
      console.log(`\n[Failure ${idx + 1}] Test: ${err.test}`);
      console.log(`Error Stack:\n${err.error.stack || err.error}`);
    });
  } else {
    console.log('All tests passed successfully!');
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch((err) => {
  console.error('Unhandled Test Execution Error:', err);
  process.exit(1);
});
