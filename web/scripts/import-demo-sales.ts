import {openSalesStore} from "../src/lib/sales-store";
const store=openSalesStore();
try {console.log(JSON.stringify(store.importDemo("owner"),null,2));}
finally {store.close();}
