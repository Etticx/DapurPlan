import {openInventoryStore} from "../src/lib/inventory-store";
const store=openInventoryStore();
try{console.log(JSON.stringify(store.fillDemoExpiries("owner"),null,2));}
finally{store.close();}
