// debug.js
console.log('🚀 Starting debug...');

try {
    console.log('Loading express...');
    const express = require('express');
    console.log('✅ express loaded');
    
    console.log('Loading mongoose...');
    const mongoose = require('mongoose');
    console.log('✅ mongoose loaded');
    
    console.log('Loading dotenv...');
    require('dotenv').config();
    console.log('✅ dotenv loaded');
    
    console.log('Loading models...');
    const User = require('./models/User');
    console.log('✅ User model loaded');
    
    console.log('Loading routes...');
    const auth = require('./api/auth');
    console.log('✅ auth routes loaded');
    
    console.log('🎉 All modules loaded successfully!');
} catch (err) {
    console.error('❌ ERROR:', err.message);
    console.error(err.stack);
}