// debug-routes.js
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

console.log('\n🔍 DEBUGGING QUANTUMPAY');
console.log('='.repeat(50));

// Check environment
console.log('\n📁 ENVIRONMENT:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ set' : '❌ missing');

// Test database connection
console.log('\n🗄️  DATABASE:');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quantumpay')
    .then(() => {
        console.log('✅ Database connected');
        console.log('Host:', mongoose.connection.host);
        console.log('Database:', mongoose.connection.name);
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Database error:', err.message);
        process.exit(1);
    });