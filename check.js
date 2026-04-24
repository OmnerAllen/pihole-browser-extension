const fs = require('fs');

const vue = fs.readFileSync('src/module/option/vue/settings/OptionTabComponent.vue', 'utf8');
const enumFile = fs.readFileSync('src/service/i18NService.ts', 'utf8');
const json = fs.readFileSync('_locales/en/messages.json', 'utf8');

const t1 = 'option_connection_check_retrying';
const t2 = 'option_connection_check_retry_button';

console.log('Vue 1:', vue.includes(t1));
console.log('Vue 2:', vue.includes(t2));
console.log('Enum 1:', enumFile.includes(t1));
console.log('Enum 2:', enumFile.includes(t2));
console.log('Json 1:', json.includes(t1));
console.log('Json 2:', json.includes(t2));
