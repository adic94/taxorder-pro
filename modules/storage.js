// TaxOrder Fleet Manager
// Storage Adapter v1

export const Storage = {

getCurrentCompany() {
return localStorage.getItem('dt1_current_company');
},

setCurrentCompany(companyId) {
localStorage.setItem('dt1_current_company', companyId);
},

getCompanyStates() {
return JSON.parse(
localStorage.getItem('dt1_company_states') || '{}'
);
},

saveCompanyStates(data) {
localStorage.setItem(
'dt1_company_states',
JSON.stringify(data)
);
},

getFleetCards() {
return JSON.parse(
localStorage.getItem('dt1_karty') || '[]'
);
},

saveFleetCards(cards) {
localStorage.setItem(
'dt1_karty',
JSON.stringify(cards)
);
}

};