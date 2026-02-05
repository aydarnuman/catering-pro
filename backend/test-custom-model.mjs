#!/usr/bin/env node
/**
 * Azure Custom Model Test
 * API version 2024-11-30 ile test
 */

import fs from 'fs';
import { config } from 'dotenv';
config({ path: './.env' });

const ENDPOINT = process.env.AZURE_DOCUMENT_AI_ENDPOINT;
const KEY = process.env.AZURE_DOCUMENT_AI_KEY;
const MODEL_ID = process.env.AZURE_DOCUMENT_AI_MODEL_ID || 'ihale-catering-v1';
const API_VERSION = '2024-11-30';

// Test with a small PDF
const TEST_PDF = './scripts/azure-training/documents/tender_2_teknik.pdf';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     AZURE CUSTOM MODEL TEST - API v2024-11-30              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log('\n📋 Config:');
  console.log(`   Endpoint: ${ENDPOINT?.substring(0, 50)}...`);
  console.log(`   Model ID: ${MODEL_ID}`);
  console.log(`   API Version: ${API_VERSION}`);
  
  if (!ENDPOINT || !KEY) {
    console.error('❌ Azure credentials not set!');
    return;
  }
  
  if (!fs.existsSync(TEST_PDF)) {
    console.error(`❌ Test PDF not found: ${TEST_PDF}`);
    return;
  }
  
  const pdfBuffer = fs.readFileSync(TEST_PDF);
  console.log(`\n📄 Test PDF: ${TEST_PDF}`);
  console.log(`   Size: ${Math.round(pdfBuffer.length / 1024)} KB`);
  
  // Step 1: Start analysis
  console.log('\n🚀 Starting analysis...');
  const analyzeUrl = `${ENDPOINT}documentintelligence/documentModels/${MODEL_ID}:analyze?api-version=${API_VERSION}`;
  console.log(`   URL: ${analyzeUrl.substring(0, 80)}...`);
  
  const startTime = Date.now();
  
  try {
    const startResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/pdf',
      },
      body: pdfBuffer,
    });
    
    console.log(`   Response status: ${startResponse.status}`);
    
    if (!startResponse.ok) {
      const errorBody = await startResponse.text();
      console.error(`❌ Start failed: ${errorBody}`);
      return;
    }
    
    const operationLocation = startResponse.headers.get('Operation-Location');
    console.log(`   Operation Location: ${operationLocation?.substring(0, 80)}...`);
    
    if (!operationLocation) {
      console.error('❌ No Operation-Location header!');
      return;
    }
    
    // Step 2: Poll for result
    console.log('\n⏳ Polling for result...');
    let pollCount = 0;
    let result;
    
    while (pollCount < 60) {
      await sleep(2000);
      pollCount++;
      
      const pollResponse = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': KEY },
      });
      
      const pollResult = await pollResponse.json();
      console.log(`   Poll ${pollCount}: ${pollResult.status}`);
      
      if (pollResult.status === 'succeeded') {
        result = pollResult.analyzeResult;
        break;
      } else if (pollResult.status === 'failed') {
        console.error(`❌ Analysis failed: ${pollResult.error?.message}`);
        return;
      }
    }
    
    if (!result) {
      console.error('❌ Timed out!');
      return;
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ SUCCESS! (${elapsed}s)`);
    
    // Show results
    console.log('\n📊 Results:');
    console.log(`   Documents: ${result.documents?.length || 0}`);
    console.log(`   Tables: ${result.tables?.length || 0}`);
    console.log(`   Pages: ${result.pages?.length || 0}`);
    
    if (result.documents?.[0]?.fields) {
      console.log('\n📋 Extracted Fields:');
      for (const [key, field] of Object.entries(result.documents[0].fields)) {
        const value = field.valueString || field.valueNumber || field.content || '[complex]';
        const conf = field.confidence ? ` (${(field.confidence * 100).toFixed(0)}%)` : '';
        console.log(`   ${key}: ${value.toString().substring(0, 60)}${conf}`);
      }
    }
    
    // Save full result
    fs.writeFileSync('/tmp/custom_model_result.json', JSON.stringify(result, null, 2));
    console.log('\n💾 Full result saved to /tmp/custom_model_result.json');
    
  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
  }
}

main().catch(console.error);
