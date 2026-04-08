const axios = require('axios');
const i = axios.create({baseURL: 'http://example.com/api/'});
console.log(i.getUri({url: '/dns/blocking'}));
const i2 = axios.create({baseURL: 'http://example.com/api'});
console.log(i2.getUri({url: '/dns/blocking'}));
