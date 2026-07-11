// ==================== DATA ====================
const VEHICLES = [{"nrRej":"WGM87205","marka":"Fuso","model":"Canter 9/18","rok":2020,"typ":"Ciężarowy","dmc":8500,"euro":"EURO 6","vin":"TYBFECX1ELDC03229","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WU6647K","marka":"Fuso","model":"Canter 7/15","rok":2020,"typ":"Ciężarowy","dmc":7500,"euro":"EURO 6","vin":"TYBFEB71ELDC04538","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM89755","marka":"Fuso","model":"Canter 7/15 BR","rok":2020,"typ":"Ciężarowy","dmc":7500,"euro":"EURO 6","vin":"TYBFEB71ELDC04728","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WL3597R","marka":"Fuso","model":"Canter 7/15","rok":2020,"typ":"Ciężarowy","dmc":7500,"euro":"EURO 6","vin":"TYBFEB71ELDC07336","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WW024AF","marka":"GFOLLNER","model":"APL 2/4 TL","rok":2015,"typ":"Przyczepa","dmc":14000,"euro":"","vin":"VASAL214YFGPA8689","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WA5535C","marka":"Iveco","model":"EUROCARGO ML75E15","rok":2006,"typ":"Ciężarowy","dmc":7500,"euro":"EURO 3","vin":"ZCFA75B0202483032","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM0065L","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXRY456838","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ124HW","marka":"MAN","model":"TGE 6.160 5.5T","rok":2024,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ7R9018317","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ122HW","marka":"MAN","model":"TGE 6.160 5.5T","rok":2024,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ2R9018256","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ123HW","marka":"MAN","model":"TGE 6.160 5.5T","rok":2024,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ9R9018285","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ389HM","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXRP250540","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ390HM","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9RP250481","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL7611V","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXRP250487","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL7602V","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9RP250769","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8172K","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"","vin":"WMA12DZZ1R9250457","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ495HU","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ5RP252776","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ496HU","marka":"MAN","model":"TGL 8.190-M","rok":2024,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1RP244920","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ883KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"","vin":"WMA12DZZ3SP315203","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ884KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"","vin":"WMA12DZZ4SP315257","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ882KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"","vin":"WMA12DZZ5SP315221","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ881KA","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ2SP315998","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ320KA","marka":"MAN","model":"TGM 4X4-G","rok":2025,"typ":"Ciężarowy","dmc":11990,"euro":"EURO 6","vin":"WMA36DZZ6RP277456","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ321KA","marka":"MAN","model":"TGM 4X4-G","rok":2025,"typ":"Ciężarowy","dmc":11990,"euro":"EURO 6","vin":"WMA36DZZ2RP277518","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ322KA","marka":"MAN","model":"TGM 4X4-G","rok":2025,"typ":"Ciężarowy","dmc":11990,"euro":"EURO 6","vin":"WMA36DZZ9RP277824","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8572M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ4SP315226","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8573M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ2SP315371","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8574M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ4SP315243","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM8575M","marka":"MAN","model":"TGL 8.190-M","rok":2025,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ4SP315209","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR7520T","marka":"MAN","model":"TGE 6.160 5.5T","rok":2023,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ2R9007581","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR7519T","marka":"MAN","model":"TGE 6.160 5.5T","rok":2023,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ8R9006457","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM0473H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ2NY443995","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM0472H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1NY443986","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4921H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ8PY444152","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4922H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9NY443945","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM5469H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1PY448110","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM6162J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ0PY452892","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM6163J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ7PY453389","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4268J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9PY452938","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4269J","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ5PY453424","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ521GG","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ3PY452935","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ520GG","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ3PY453275","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ497GH","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ1PY453288","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ496GH","marka":"MAN","model":"TGL 8.190-M","rok":2023,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ3PY453292","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WA5790C","marka":"MAN","model":"TGL 8","rok":2010,"typ":"Ciężarowy","dmc":7500,"euro":"EURO 5","vin":"WMAN03ZZ5AY247514","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WW1670X","marka":"MAN","model":"18.225 LC","rok":2003,"typ":"Ciężarowy","dmc":16000,"euro":"EURO 3","vin":"WMAL87ZZZ3Y113513","status":"Wynajęty","wlasciciel":"KJR Supply"},{"nrRej":"WGM4903C","marka":"MAN","model":"TGL 8.190-G","rok":2021,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ0MY430077","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM4904C","marka":"MAN","model":"TGL 8.190-G","rok":2021,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ6MY430083","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR5174P","marka":"MAN","model":"TGE 6.180 5,5T","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ9M9016738","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WPR5173P","marka":"MAN","model":"TGE 6.180 5,5T","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ2M9016001","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM2174H","marka":"MAN","model":"TGL 8.190-M","rok":2022,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZXPY444086","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM2175H","marka":"MAN","model":"TGL 8.190-G","rok":2022,"typ":"Ciężarowy","dmc":8800,"euro":"EURO 6","vin":"WMA12DZZ9NY443931","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ084KP","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZXT9002765","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ807KL","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ1S9030842","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ806KL","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ3S9024220","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ805KL","marka":"MAN","model":"TGE 6.160 5.5T","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WMA29VUZ1S9024829","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ209LJ","marka":"Meprozet","model":"PN-1 asenizacyjna","rok":2025,"typ":"Przyczepa","dmc":16200,"euro":"","vin":"250480012","status":"Wynajęty","wlasciciel":"GCON"},{"nrRej":"WZ274KL","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33ZXTN354520","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ273KL","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z8TN355150","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ694KR","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z7TN355897","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ724KP","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2025,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z6TN356071","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL9652T","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2022,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N221239","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL9625T","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2022,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N215193","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WU7721N","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310591672","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ695FE","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310591671","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ732FE","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2022,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N193696","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL6049T","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601267","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ960FF","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601266","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ961FF","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601265","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ962FF","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601264","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ093EV","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310582526","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ619EY","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310582527","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ620EY","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310583288","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ952EP","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532645","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ748EY","marka":"Mercedes","model":"Sprinter 5.5T 4X4","rok":2017,"typ":"Ciężarowy","dmc":5000,"euro":"EURO 6","vin":"WDB9061531N745826","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WZ953EP","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532644","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ951EP","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532253","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ369EH","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310532254","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WU6528M","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N141543","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ931CV","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N141086","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ930CV","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N141313","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ929CV","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N143606","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM9423A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310509057","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM9424A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310509401","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM2116C","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516336","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WL8328R","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516337","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WZ971CS","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516335","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ336CR","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310516338","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ493CU","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N140067","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL1814U","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N140624","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ491CU","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2021,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N145584","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ772CK","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310504315","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM9630A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310510109","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM9629A","marka":"Mercedes","model":"Atego 2-M","rok":2021,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310510110","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL4505R","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310496511","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM91914","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310461203","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM95870","marka":"Mercedes","model":"Sprinter 5.5T BR","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104169","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM95867","marka":"Mercedes","model":"Sprinter 5.5T BR","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N106207","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WB2860V","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N105969","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WB2985V","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104399","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WL8251P","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310469256","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WB8489U","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N092173","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM89756","marka":"Mercedes","model":"Sprinter 5.5T BR","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N093755","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM91975","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N103276","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM92044","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467667","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM91998","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N103480","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM89010","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467074","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WL6526P","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467945","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WL6527P","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467944","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM93611","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467816","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM93664","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310467817","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM93535","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104398","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM93534","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N104628","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WGM84083","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"WDB96702310423253","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WW715AR","marka":"Mercedes","model":"Atego 2-G","rok":2020,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310437502","status":"Wynajęty","wlasciciel":"GCON"},{"nrRej":"WB6684U","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2020,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N091252","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WWL5562K","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N054964","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WW7846Y","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N054963","status":"Wynajęty","wlasciciel":"GCON"},{"nrRej":"WWL2203L","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N056333","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WWL5561K","marka":"Mercedes","model":"Sprinter 5.5T 3.0 CDI","rok":2019,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"WDB9071551N056074","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ518GG","marka":"Mercedes","model":"Atego 2-M","rok":2023,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702210663640","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ519GG","marka":"Mercedes","model":"Atego 2-G","rok":2023,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702410663641","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL6680U","marka":"Mercedes","model":"Atego 2-M","rok":2023,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702610663639","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL6681U","marka":"Mercedes","model":"Atego 2-M","rok":2023,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702410663638","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ726GP","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2023,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z6PN245154","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ227FT","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2022,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N223371","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ226FT","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2022,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N213977","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ428FL","marka":"Mercedes","model":"Atego 2-M","rok":2022,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310601263","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ846FL","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2022,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N196127","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ266FT","marka":"Mercedes","model":"Sprinter 5.5T 2.2 CDI","rok":2023,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N223979","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ264FT","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2022,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V9071551N215197","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ594GW","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2023,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z4RN269312","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WL4360X","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702810823343","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ872KC","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702110823345","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ871KC","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702X10823344","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WE5HX36","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702610823342","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ481KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702210821314","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ479KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702510823624","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ480KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702010821313","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ471KK","marka":"Mercedes","model":"Atego 2-M","rok":2025,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702510821534","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ232HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702510769726","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ234HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702310769725","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ230HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702110769724","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ231HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702210770333","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ233HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702010770332","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ235HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702710770005","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ236HW","marka":"Mercedes","model":"Atego 2-M","rok":2024,"typ":"Ciężarowy","dmc":9500,"euro":"EURO 6","vin":"W1T96702410770334","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WGM0867L","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2024,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z1RN308048","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ121HW","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2024,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33ZXRN307061","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ120HW","marka":"Mercedes","model":"Sprinter 5.5T 2.0 CDI","rok":2024,"typ":"Ciężarowy","dmc":5500,"euro":"EURO 6","vin":"W1V5M33Z8RN302067","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WA8920J","marka":"Mercedes","model":"Atego 4X4","rok":2011,"typ":"Ciężarowy","dmc":10500,"euro":"EURO 5","vin":"WDB9763331L548244","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WA9885J","marka":"Mercedes","model":"Actros","rok":2016,"typ":"Ciężarowy","dmc":26000,"euro":"","vin":"WDB96302010057230","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WW239AF","marka":"Pronar","model":"T679/3 wywrotka","rok":2026,"typ":"Przyczepa","dmc":11400,"euro":"","vin":"SZB6793XXT1X00315","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WW564AJ","marka":"Scania","model":"R520","rok":2015,"typ":"Ciężarowy","dmc":26000,"euro":"EURO 6","vin":"YS2R6X20005391826","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ621FY","marka":"Scania","model":"R580","rok":2015,"typ":"Ciężarowy","dmc":30000,"euro":"EURO 6","vin":"YS2R6X20005388005","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WA0677L","marka":"Scania","model":"R490 Szambiarka","rok":2017,"typ":"Ciężarowy","dmc":27000,"euro":"EURO 6","vin":"YS2R6X20005482489","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WA4789F","marka":"Scania","model":"R540 Wodolejka","rok":2021,"typ":"Ciężarowy","dmc":27000,"euro":"EURO 6","vin":"YS2R8X40002177169","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WW117AF","marka":"Sonst","model":"ANH. Hersteller","rok":2016,"typ":"Przyczepa","dmc":18000,"euro":"","vin":"W09TP28471A006V08","status":"Wynajęty","wlasciciel":"GCON"},{"nrRej":"WA1697F","marka":"Volvo","model":"FMX 8x4","rok":2011,"typ":"Ciężarowy","dmc":32000,"euro":"EURO 5","vin":"YV2JG20G9BA714219","status":"Własny","wlasciciel":"mToilet"},{"nrRej":"WA2609J","marka":"Volvo","model":"FH 540 Szambiarka","rok":2020,"typ":"Ciężarowy","dmc":32000,"euro":"EURO 6","vin":"YV2RT60G2KA853081","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ899GJ","marka":"Volvo","model":"FMX 6x2","rok":2016,"typ":"Ciężarowy","dmc":28000,"euro":"EURO 6","vin":"YV2XT60C0GA789117","status":"Leasing","wlasciciel":"mToilet"},{"nrRej":"WZ464FY","marka":"Volvo","model":"FH 540 Wodolejka","rok":2018,"typ":"Ciężarowy","dmc":32000,"euro":"EURO 6","vin":"YV2RT60C5JA833371","status":"Własny","wlasciciel":"mToilet"}];

// State
let vehs = VEHICLES.map((v,i) => ({...v, id:i, osie: v.osie||(((v.dmc||v.dmcMax||0)>=12000)?3:2), zawieszenie:'pneumatyczne', dmcZespolu:0, miesiacePodatku:12}));
window.vehs = vehs;
let selected = new Set();
window.selected = selected;
let sortKey = 'nrRej', sortAsc = true;
var _vehPage = 0, _vehPageSize = 100, _lastFilteredLen = -1;
var _dateFilters = { ocFrom: '', ocTo: '', acFrom: '', acTo: '', inspFrom: '', inspTo: '' };

// ── Konfiguracja API ──────────────────────────────────────────────────────────
window.CF_WORKER_URL = 'https://taxorder-pro-api.adamus1000.workers.dev';

// ==================== RATES (Warszawa 2026 + multi-gmina) ====================
function getRate(v) {
  // Jeśli GminyRates dostępne i gmina skonfigurowana — użyj jej stawek
  if (window.GminyRates) {
    const r = GminyRates.getGminaRate(v);
    if (r != null) return r;
  }
  return _getRate_legacy(v);
}

function _getRate_legacy(v) {
  if (v.dmc == null && v.dmcMax == null) return null;
  const dT=(v.dmc??v.dmcMax??0)/1000, dzT=(v.dmcZespolu||0)/1000, refZ=dzT>0?dzT:dT;
  const typ=(v.typ||'').toLowerCase(), osie=parseInt(v.osie||v.liczbaOsi)||2, rok=parseInt(v.rok)||0, isNew=rok>=2024;
  if(typ.includes('autobus')) return isNew?1320:(parseInt(v.miejsca)||0)<30?1488:1872;
  if(typ.includes('naczepa')||typ.includes('przyczepa')) {
    if(refZ>=7&&refZ<12) return isNew?1128:1248;
    if(refZ>=12) {
      if(osie===1){if(refZ<18)return 744;if(refZ<25)return 840;if(refZ<=36)return 984;return 1128;}
      if(osie===2){if(refZ<28)return 1488;if(refZ<33)return 1776;if(refZ<38)return 2256;return 2976;}
      if(refZ<=36)return 1872;if(refZ<38)return 2040;return 2232;
    }
    return null;
  }
  if(typ.includes('ciągnik')||typ.includes('ciagnik')) {
    if(refZ>=3.5&&refZ<12) return isNew?1248:1392;
    if(refZ>=12) {
      if(osie<=2){if(refZ<18)return 1128;if(refZ<25)return 1680;if(refZ<31)return 2232;if(refZ<=36)return 3384;return 3384;}
      if(refZ<=36)return 2784;if(refZ<40)return 2832;return 4200;
    }
    return null;
  }
  if(dT<=3.5) return null;
  if(dT<12) { if(isNew){if(dT<=5.5)return 744;if(dT<=9)return 1008;return 1344;} if(dT<=5.5)return 840;if(dT<=9)return 1128;return 1488; }
  if(osie===2){if(dT<13)return 1200;if(dT<14)return 1488;if(dT<15)return 1680;return 2184;}
  if(osie===3){if(dT<17)return 1488;if(dT<19)return 1704;if(dT<21)return 1872;if(dT<23)return 2136;return 2760;}
  if(dT<25)return 1488;if(dT<27)return 1824;if(dT<29)return 2880;return 4296;
}  // end _getRate_legacy

function getCat(v) {
  if (v.dmc == null && v.dmcMax == null) return null;
  const dT=(v.dmc??v.dmcMax??0)/1000, dzT=(v.dmcZespolu||0)/1000, refZ=dzT>0?dzT:dT;
  const typ=(v.typ||'').toLowerCase(), osie=parseInt(v.osie||v.liczbaOsi)||2;
  // Pojazdy specjalne są zwolnione z podatku DT-1
  if(typ.includes('specjaln')||(v.przeznaczenie||'').toLowerCase().includes('specjaln')) return null;
  if(typ.includes('autobus')) return (parseInt(v.miejsca)||0)<22?'D6':'D7';
  if(typ.includes('naczepa')||typ.includes('przyczepa')) {
    if(refZ>=12) return osie===1?'D13':osie===2?'D14':'D15';
    if(refZ>=7) return 'D5';
    return null;
  }
  if(typ.includes('ciągnik')||typ.includes('ciagnik')) {
    if(refZ>=12) return osie<=2?'D11':'D12';
    if(refZ>=3.5) return 'D4';
    return null;
  }
  if(dT<=3.5) return null;
  if(dT>=12) return osie===2?'D8':osie===3?'D9':'D10';
  if(dT<=5.5) return 'D1'; if(dT<=9) return 'D2'; if(dT<12) return 'D3';
  return null;
}

function calcTax(v) {
  if (window.TaxEngine) return window.TaxEngine.calcTax(v);
  // fallback gdy tax-engine.js nie załadowany
  const cat = getCat(v); if(!cat) return {cat:null,amount:0,rate:0};
  const rate = getRate(v)||0;
  const m = Math.min(Math.max(parseInt(v.miesiacePodatku)||12, 1), 12);
  return {cat, amount: Math.round((rate*m)/12*100)/100, rate, months:m, isNew: (parseInt(v.rok)||0)>=2024};
}

const CAT_COLORS = {D1:'pill-blue',D2:'pill-green',D3:'pill-amber',D4:'pill-amber',D5:'pill-green',D6:'pill-blue',D7:'pill-blue',D8:'pill-red',D9:'pill-red',D10:'pill-red',D11:'pill-red',D12:'pill-red',D13:'pill-amber',D14:'pill-amber',D15:'pill-amber'};
const CAT_LABELS = {D1:'Sam.cięż. 3,5–5,5t',D2:'Sam.cięż. 5,5–9t',D3:'Sam.cięż. 9–12t',D4:'Ciągnik <12t',D5:'Przyczepa 7–12t',D6:'Autobus <22m.',D7:'Autobus ≥22m.',D8:'Ciężarowy ≥12t 2os.',D9:'Ciężarowy ≥12t 3os.',D10:'Ciężarowy ≥12t 4+',D11:'Ciągnik ≥12t 2os.',D12:'Ciągnik ≥12t 3+',D13:'Przyczepa ≥12t 1oś',D14:'Przyczepa ≥12t 2os.',D15:'Przyczepa ≥12t 3+'};
const STAT_LABELS = {Własny:'pill-green',Leasing:'pill-blue',Wynajęty:'pill-amber'};

function fmt2(n) { return Number(n).toFixed(2).replace('.',','); }
function fmtZl(n) { return Math.round(n).toLocaleString('pl-PL'); }
function fmtT(kg) { return kg?(kg/1000).toFixed(3).replace('.',','):'—'; }

// ==================== DARK MODE ====================
function _applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon = document.getElementById('dark-mode-icon');
  if (icon) {
    icon.className = dark ? 'ti ti-sun' : 'ti ti-moon';
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const next = !isDark;
  localStorage.setItem('taxDarkMode', next ? '1' : '0');
  _applyTheme(next);
}

// Zastosuj motyw przy starcie (data-theme natychmiast, ikona po DOM ready)
;(function() {
  const saved = localStorage.getItem('taxDarkMode');
  const preferDark = saved === '1' || (saved === null && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', preferDark ? 'dark' : 'light');
  document.addEventListener('DOMContentLoaded', () => _applyTheme(preferDark));
})();

// ==================== NAVIGATION ====================
// Otwiera/zamyka sidebar na urządzeniach mobilnych
function toggleMobileNav(forceClose) {
  const sidebar  = document.getElementById('main-sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  if (!sidebar || !overlay) return;
  const isOpen = sidebar.classList.contains('open');
  if (forceClose || isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }
}

// Event delegation — każdy klik .tnb (w tym modale) zamyka sidebar na mobile
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('main-sidebar')?.addEventListener('click', e => {
    if (e.target.closest('.tnb')) setTimeout(() => toggleMobileNav(true), 80);
  });
});

function showPage(id) {
  if(typeof saveCompanyState === 'function') saveCompanyState();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tnb').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+id)?.classList.add('active');
  const tnb = document.getElementById('tnb-'+id);
  if(tnb) tnb.classList.add('active');
  // Zamknij sidebar po wyborze strony na mobile
  toggleMobileNav(true);
  if(id==='pojazdy') renderVeh();
  if(id==='kalkulator') renderKalkulator();
  if(id==='formularze') renderFormularze();
  if(id==='pd') updatePD();
  if(id==='dash') renderDash();
  if(id==='walidacja') { runValidation(); }
  if(id==='raporty') { renderRaporty(); window.FleetReports?.renderPage(); window.FleetReports?.renderServicePlan(); window.FleetReports?.renderMaintenanceKm(); window.FleetReports?.renderKobize(); window.FleetReports?.renderTco(); window.FleetReports?.renderInsuranceReport(); FleetReports?.initPdfSelectors?.(); }
  if(id==='ocr') renderOcrHistory();
  if(id==='faktury') renderFakHistory();
  if(id==='pdfexport') updatePdfSummary();
  if(id==='impexp') { document.getElementById('exp-sel-cnt').textContent=selected.size; const _allCnt=document.getElementById('exp-all-cnt'); if(_allCnt) _allCnt.textContent=vehs.length; window.TekomSync?.renderSection('tekom-section'); }
  if(id==='karty') renderKarty();
  if(id==='szkody') window.TaxOrderDamages?.load();
  if(id==='opony-magazyn') window.TaxOrderTires?.load();
  if(id==='zlecenia') window.TaxOrderServiceOrders?.load();
  if(id==='protokoly') window.TaxOrderHandoverProtocol?.load();
  if(id==='cfm-klienci') window.TaxOrderCfmClients?.load();
  if(id==='cfm-kontrakty') { window.TaxOrderCfmClients?.load(); window.TaxOrderCfmContracts?.load(); }
  if(id==='cfm-faktury') { window.TaxOrderCfmClients?.load(); window.TaxOrderCfmContracts?.load(); window.TaxOrderCfmInvoices?.load(); }
  if(id==='uzytkownicy') renderUsers();
  if(id==='api-klucze') window.TaxOrderApiKeys?.load();
  if(id==='cepik') initCepikPage();
  if(id==='firmy') { if(typeof renderCompanyOverview==='function') renderCompanyOverview(); }
  if(id==='paliwo') renderPaliwoPage();
  if(id==='alert-dashboard') window.TaxOrderAlertDashboard?.load();
  if(id==='terminarz') window.TaxOrderInspectionCalendar?.load();
  if(id==='powiadomienia') window.TaxOrderNotifSettings?.load();
  if(id==='polisy-ocr') window.TaxOrderPolicyOcr?.load();
  if(id==='stawki') window.GminyRates?.renderComparison('gmina-comparison-result');
  if(id==='dr-import') window.TaxOrderDrImport?.load();
  if(id==='dt1-historia') window.Dt1Declarations?.load();
  if(id==='webhooks') window.WebhooksUI?.load();
  if(id==='errors-admin') renderErrorsAdmin();
  if(id==='mapa') window.FleetMap?.render();
  if(id==='kalendarz') window.FleetCalendar?.open();
  if(id==='budzet') window.TaxOrderBudget?.render();
  document.dispatchEvent(new CustomEvent('taxorder-page-change', { detail: { page: id } }));
  updateCounters();
}

// ==================== POJAZDY ====================
function _hasExpiryAlert(v) {
  const now = new Date(); now.setHours(0,0,0,0); const W = 60 * 86400000;
  return [v.ocEnd, v.acEnd, v.nextInspection,
    ...(v.hasUdt && v.udtNextDate ? [v.udtNextDate] : []),
    ...(v.hasTacho && v.tachoNextCalib ? [v.tachoNextCalib] : []),
    ...(v.tireNextChange ? [v.tireNextChange] : []),
    ...(v.serviceHistory||[]).filter(s=>s.nextServiceDate).map(s=>s.nextServiceDate),
    ...(v.leasingEnd ? [v.leasingEnd] : []),
    ...(v.rentalEnd  ? [v.rentalEnd]  : []),
  ].some(d => d && (new Date(d) - now) < W);
}

function filterVeh() {
  const q = (document.getElementById('q-veh')?.value||'').toLowerCase();
  const fTyp = document.getElementById('f-typ')?.value||'';
  const fStat = document.getElementById('f-status')?.value||'';
  const fWl = document.getElementById('f-wl')?.value||'';
  const fAlert = document.getElementById('f-alert')?.value||'';
  return vehs.filter(v => {
    if (window._driverFilter && v.kierowca !== window._driverFilter) return false;
    if (q && !v.nrRej.toLowerCase().includes(q) && !v.marka.toLowerCase().includes(q) && !v.model.toLowerCase().includes(q) && !(v.vin||'').toLowerCase().includes(q) && !(v.kierowca||'').toLowerCase().includes(q)) return false;
    if (fTyp && v.typ !== fTyp) return false;
    if (fStat && v.status !== fStat) return false;
    if (fWl && v.wlasciciel !== fWl) return false;
    if (fAlert) {
      const now = new Date(); now.setHours(0,0,0,0);
      const _days = ds => { if (!ds) return null; const d = new Date(ds + (ds.includes('T')?'':'T00:00:00')); return isNaN(d) ? null : Math.round((d - now) / 86400000); };
      const _isExpired = vv => [vv.ocEnd, vv.acEnd, vv.nextInspection].some(d => d && new Date(d) < now);
      if (fAlert === 'alert'       && !_hasExpiryAlert(v))                               return false;
      if (fAlert === 'expired'     && !_isExpired(v))                                    return false;
      if (fAlert === 'ok'          && _hasExpiryAlert(v))                                return false;
      if (fAlert === 'oc_expired'  && !(_days(v.ocEnd) !== null && _days(v.ocEnd) < 0))  return false;
      if (fAlert === 'oc_7'        && !(_days(v.ocEnd) !== null && _days(v.ocEnd) >= 0 && _days(v.ocEnd) <= 7))   return false;
      if (fAlert === 'oc_30'       && !(_days(v.ocEnd) !== null && _days(v.ocEnd) >= 0 && _days(v.ocEnd) <= 30))  return false;
      if (fAlert === 'ac_expired'  && !(_days(v.acEnd) !== null && _days(v.acEnd) < 0))  return false;
      if (fAlert === 'ac_30'       && !(_days(v.acEnd) !== null && _days(v.acEnd) >= 0 && _days(v.acEnd) <= 30))  return false;
      if (fAlert === 'insp_expired'&& !(_days(v.nextInspection) !== null && _days(v.nextInspection) < 0)) return false;
      if (fAlert === 'insp_30'     && !(_days(v.nextInspection) !== null && _days(v.nextInspection) >= 0 && _days(v.nextInspection) <= 30)) return false;
      if (fAlert === 'no_driver'       && v.kierowca)                                            return false;
      if (fAlert === 'no_oc'           && v.ocEnd)                                             return false;
      if (fAlert === 'leasing_expired' && !(_days(v.leasingEnd)!==null&&_days(v.leasingEnd)<0)) return false;
      if (fAlert === 'leasing_30'      && !(_days(v.leasingEnd)!==null&&_days(v.leasingEnd)>=0&&_days(v.leasingEnd)<=30)) return false;
    }
    // Date range filters
    const _inDateRange = (ds, from, to) => {
      if (!ds) return !(from || to);
      if (from && ds < from) return false;
      if (to && ds > to) return false;
      return true;
    };
    if ((_dateFilters.ocFrom || _dateFilters.ocTo) && !_inDateRange(v.ocEnd, _dateFilters.ocFrom, _dateFilters.ocTo)) return false;
    if ((_dateFilters.acFrom || _dateFilters.acTo) && !_inDateRange(v.acEnd, _dateFilters.acFrom, _dateFilters.acTo)) return false;
    if ((_dateFilters.inspFrom || _dateFilters.inspTo) && !_inDateRange(v.nextInspection, _dateFilters.inspFrom, _dateFilters.inspTo)) return false;
    // Per-column filters
    for (const [col, val] of Object.entries(_colFilters)) {
      if (!val) continue;
      const lv = val.toLowerCase();
      const fv = String(v[col] ?? '').toLowerCase();
      if (col === 'nrRej' && !v.nrRej.toLowerCase().includes(lv)) return false;
      else if (col === 'marka' && !(v.marka+' '+v.model).toLowerCase().includes(lv)) return false;
      else if (col === 'oc' && !String(v.ocEnd||'').includes(val)) return false;
      else if (col === 'ac' && !String(v.acEnd||'').includes(val)) return false;
      else if (col === 'przeglad' && !String(v.nextInspection||'').includes(val)) return false;
      else if (col === 'ocInsurer' && !(String(v.ocInsurer||'')+' '+String(v.ocPolicyNo||'')).toLowerCase().includes(lv)) return false;
      else if (col === 'acInsurer' && !(String(v.acInsurer||'')+' '+String(v.acPolicyNo||'')).toLowerCase().includes(lv)) return false;
      else if (col === 'kierowca' && !String(v.kierowca||'').toLowerCase().includes(lv)) return false;
      else if (col === 'vin' && !(v.vin||'').toLowerCase().includes(lv)) return false;
      else if (col === 'paliwo' && !String(v.paliwo||'').toLowerCase().includes(lv)) return false;
      else if (col === 'dataRej' && !String(v.dataRejestracji||v.dataRej||'').includes(val)) return false;
      else if (col === 'katDR' && !String(v.katPojazdu||v.kategoria||'').toLowerCase().includes(lv)) return false;
      else if (col === 'dmcF2' && !String(v.dmcKg2??'').includes(val)) return false;
      else if (col === 'ladownosc') {
        const _d=v.dmcKg2||v.dmc||v.dmcMax,_m=v.masaWlasna??v.masaWlKg;
        const l=v.ladownosc!=null&&v.ladownosc!==''?Number(v.ladownosc):(_d&&_m!=null?Number(_d)-Number(_m):null);
        if(!String(l??'').includes(val)) return false;
      }
      else if (['rok','dmc','km','poj','mocKw','masaWl','msc'].includes(col) && !fv.includes(lv)) return false;
    }
    return true;
  }).sort((a,b) => {
    let va=a[sortKey]||'', vb=b[sortKey]||'';
    if(typeof va==='number') return sortAsc?va-vb:vb-va;
    return sortAsc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
  });
}

function applyColFilter(col, val) {
  _colFilters[col] = val;
  try { localStorage.setItem(_COL_FILTERS_LS, JSON.stringify(_colFilters)); } catch {}
  renderVeh();
}

function clearColFilters() {
  _colFilters = {};
  try { localStorage.removeItem(_COL_FILTERS_LS); } catch {}
  renderVeh();
}

function applyDateFilter(field, val) {
  _dateFilters[field] = val;
  _vehPage = 0;
  renderVeh();
}

function clearDateFilters() {
  _dateFilters = { ocFrom: '', ocTo: '', acFrom: '', acTo: '', inspFrom: '', inspTo: '' };
  document.querySelectorAll('.date-filter-input').forEach(el => { el.value = ''; });
  _vehPage = 0;
  renderVeh();
}

function toggleDateFilters() {
  const el = document.getElementById('date-filter-row');
  if (!el) return;
  const show = el.style.display === 'none' || !el.style.display;
  el.style.display = show ? 'flex' : 'none';
  const btn = document.querySelector('button[onclick="toggleDateFilters()"]');
  if (btn) btn.className = btn.className.replace(show ? 'btn-gray' : 'btn-blue', show ? 'btn-blue' : 'btn-gray');
}

function quickFilterVeh(alertType) {
  showPage('pojazdy');
  setTimeout(() => {
    const sel = document.getElementById('f-alert');
    if (sel) { sel.value = alertType; renderVeh(); }
  }, 150);
}

function toggleFilterRow() {
  _filterRowVisible = !_filterRowVisible;
  const btn = document.getElementById('veh-filter-btn');
  if (btn) btn.className = btn.className.replace(_filterRowVisible ? 'btn-gray' : 'btn-blue', _filterRowVisible ? 'btn-blue' : 'btn-gray');
  if (!_filterRowVisible) {
    clearColFilters(); // resetuje filtry i wywołuje renderVeh() → _renderFleetThead()
  } else {
    _renderFleetThead(); // tylko pokaż wiersz filtrów z przywróconymi wartościami
  }
}

function sortBy(key) {
  if(sortKey===key) sortAsc=!sortAsc; else {sortKey=key;sortAsc=true;}
  renderVeh();
}

function _datePill(dateStr) {
  if(!dateStr) return '<span style="color:var(--text3);font-size:11px">—</span>';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const days = Math.round((d - now) / 86400000);
  const label = d.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'2-digit'});
  if(days < 0)  return `<span class="pill pill-red" title="${days} dni temu">${label}</span>`;
  if(days < 30) return `<span class="pill pill-amber" title="Za ${days} dni">${label}</span>`;
  return `<span style="font-size:11px;color:var(--text2)">${label}</span>`;
}

function _gpsIndicator(v) {
  const hist = Array.isArray(v.gpsHistory) ? v.gpsHistory : [];
  const last = hist.filter(h => h.lat && h.lon).sort((a, b) => new Date(b.ts) - new Date(a.ts))[0];
  if (!last) return '';
  const ageH = (Date.now() - new Date(last.ts).getTime()) / 3600000;
  const color = ageH < 24 ? '#16a34a' : ageH < 168 ? '#d97706' : '#dc2626';
  const label = ageH < 1 ? Math.round(ageH * 60) + ' min' : ageH < 24 ? Math.round(ageH) + 'h' : Math.round(ageH / 24) + 'd';
  return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};margin-left:5px;vertical-align:middle;flex-shrink:0" title="GPS: ${label} temu · ${last.location||last.lat?.toFixed(4)+','+last.lon?.toFixed(4)}"></span>`;
}

function _renderVehPager(fullList) {
  const el = document.getElementById('veh-pager');
  if (!el) return;
  const totalPages = Math.ceil(fullList.length / _vehPageSize);
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const start = _vehPage * _vehPageSize + 1;
  const end   = Math.min((_vehPage + 1) * _vehPageSize, fullList.length);
  const maxBtns = 7;
  let pages = [];
  if (totalPages <= maxBtns) {
    pages = Array.from({length: totalPages}, (_, i) => i);
  } else {
    pages = [0];
    const lo = Math.max(1, _vehPage - 2), hi = Math.min(totalPages - 2, _vehPage + 2);
    if (lo > 1) pages.push(-1);
    for (let i = lo; i <= hi; i++) pages.push(i);
    if (hi < totalPages - 2) pages.push(-1);
    pages.push(totalPages - 1);
  }
  el.style.cssText = 'display:flex;align-items:center;gap:6px;padding:10px 0;font-size:13px;flex-wrap:wrap';
  el.innerHTML = `
    <button class="btn btn-gray" style="padding:4px 10px" onclick="vehGoPage(${_vehPage-1})" ${_vehPage===0?'disabled':''}>‹</button>
    <span style="color:var(--text2);min-width:110px;text-align:center">${start}–${end} z ${fullList.length}</span>
    ${pages.map(i => i < 0
      ? `<span style="color:var(--text3)">…</span>`
      : `<button class="btn ${i===_vehPage?'btn-blue':'btn-gray'}" style="padding:4px 8px;min-width:32px" onclick="vehGoPage(${i})">${i+1}</button>`
    ).join('')}
    <button class="btn btn-gray" style="padding:4px 10px" onclick="vehGoPage(${_vehPage+1})" ${_vehPage===totalPages-1?'disabled':''}>›</button>
  `;
}

function vehGoPage(page) {
  const list = filterVeh();
  const totalPages = Math.ceil(list.length / _vehPageSize);
  _vehPage = Math.max(0, Math.min(page, totalPages - 1));
  _lastFilteredLen = list.length;
  renderVeh();
}

function renderVeh() {
  if (!_colVis) _initColVis();
  _renderFleetKpiStrip();
  _renderAlertBanner();
  _syncViewModeButtons();
  const list = filterVeh();

  // Reset page when filter result set changes
  if (list.length !== _lastFilteredLen) { _vehPage = 0; }
  _lastFilteredLen = list.length;
  const pageList = list.slice(_vehPage * _vehPageSize, (_vehPage + 1) * _vehPageSize);

  // Widok kart / kierowcy / kalendarz
  const tblWrap = document.getElementById('fleet-tbl-wrap');
  const cardsEl = document.getElementById('fleet-cards');
  const driverEl = document.getElementById('fleet-driver-panel');
  const calEl   = document.getElementById('fleet-calendar');
  [tblWrap, cardsEl, driverEl, calEl].forEach(el => { if (el) el.style.display = 'none'; });

  if (_viewMode === 'cards') {
    if (cardsEl) { cardsEl.style.display = 'grid'; _renderCards(pageList); }
    _renderVehPager(list); updateCounters(); return;
  }
  if (_viewMode === 'driver') {
    if (driverEl) { driverEl.style.display = 'block'; _renderDriverPanel(); }
    updateCounters(); return;
  }
  if (_viewMode === 'calendar') {
    if (calEl) { calEl.style.display = 'block'; _renderCalendarView(); }
    updateCounters(); return;
  }
  if (tblWrap) tblWrap.style.display = '';
  _renderVehPager(list);
  _renderFleetThead();

  const tbody = document.getElementById('veh-tbody');
  if(!tbody) return;
  const isTrailerV = v => (v.typ||'').toLowerCase().includes('przy')||(v.typ||'').toLowerCase().includes('nacz');
  const colOrder = _getColOrder();
  tbody.innerHTML = pageList.map(v => {
    const t = calcTax(v);
    const isSel = selected.has(v.id);
    const isNew = (parseInt(v.rok)||0)>=2024;
    const needsDmcZ = isTrailerV(v) && !v.dmcZespolu;
    const ctx = { t, isNew, needsDmcZ, isTrailerV: isTrailerV(v) };
    const _nowMs = (() => { const t = new Date(); t.setHours(0,0,0,0); return t.getTime(); })();
    const _vDays = ds => { if (!ds) return 9999; const d = new Date(ds+'T00:00:00'); return isNaN(d)?9999:Math.round((d-_nowMs)/86400000); };
    const _minDays = Math.min(_vDays(v.ocEnd), _vDays(v.acEnd), _vDays(v.nextInspection));
    const _rowAlert = _minDays < 0 ? 'row-alert-red' : _minDays <= 7 ? 'row-alert-red' : _minDays <= 30 ? 'row-alert-amber' : '';
    return `<tr class="${isSel?'row-sel':''} ${_rowAlert}" onclick="toggleRow(${v.id})" ondblclick="event.stopPropagation();TaxOrderVehicleDetail.open(${v.id})" title="Dwuklik = karta pojazdu${_rowAlert ? ' | ⚠ Alert terminów' : ''}">
      <td class="col-sticky" style="left:0" onclick="event.stopPropagation()"><input type="checkbox" ${isSel?'checked':''} onchange="toggleRow(${v.id})"></td>
      <td class="col-sticky" style="left:36px"><strong style="font-family:var(--mono)">${esc(v.nrRej)}</strong></td>
      <td class="col-sticky" style="left:136px"><div style="font-weight:500">${esc(v.marka)} ${esc(v.model)}</div><div style="font-size:11px">${esc(v.euro||'—')} · ${_vinCell(v)}</div></td>
      ${colOrder.map(id => _FLEET_COL_TD[id]?.(v, ctx) || '').join('')}
      <td style="text-align:center;white-space:nowrap" onclick="event.stopPropagation()">
        ${v.uwagi ? `<span style="color:var(--amber);font-size:13px;margin-right:4px;cursor:help" title="${esc(v.uwagi.slice(0,200))}"><i class="ti ti-note"></i></span>` : ''}
        <button class="btn btn-gray" style="font-size:11px;padding:3px 8px" onclick="TaxOrderVehicleDetail.open(${v.id})" title="Karta pojazdu">
          <i class="ti ti-id-badge"></i>
        </button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="40" style="text-align:center;padding:2rem;color:var(--text3)">Brak wyników</td></tr>`;
  updateCounters();
  _applyColVis();
}

function toggleRow(id) {
  if(selected.has(id)) selected.delete(id); else selected.add(id);
  renderVeh(); updateCounters();
}
function toggleAll(chk) { const list=filterVeh(); if(chk.checked) list.forEach(v=>selected.add(v.id)); else list.forEach(v=>selected.delete(v.id)); renderVeh(); updateCounters(); }
function selAll() { const list=filterVeh(); list.forEach(v=>selected.add(v.id)); renderVeh(); updateCounters(); toast(`☑ Zaznaczono ${list.length} pojazdów`); }
function deselAll() { selected.clear(); renderVeh(); updateCounters(); toast('☐ Odznaczono wszystkie'); }
function setV(id,k,val) { const v=vehs.find(x=>x.id===id); if(v){v[k]=val; window.TaxOrderFleetCloud?.saveVehicle(v);} renderVeh(); updateCounters(); }

// ==================== KALKULATOR ====================
function getSel() { return vehs.filter(v=>selected.has(v.id)); }
function getSelTax() { return getSel().map(v=>({...v,...calcTax(v)})); }
function totalTax() { return getSelTax().reduce((s,v)=>s+(v.amount||0),0); }

function renderKalkulator() {
  const selT = getSelTax();
  const tbody = document.getElementById('calc-tbody');
  const warn = document.getElementById('warn-no-sel');
  if(!tbody) return;
  if(selT.length===0) { tbody.innerHTML=''; if(warn)warn.classList.remove('hidden'); return; }
  if(warn) warn.classList.add('hidden');
  tbody.innerHTML = selT.map(v => `<tr>
    <td><strong style="font-family:var(--mono)">${esc(v.nrRej)}</strong></td>
    <td>${esc(v.marka)} ${esc(v.model)} <span style="font-size:11px;color:var(--text2)">${v.rok||''}</span></td>
    <td>${v.cat?`<span class="pill ${CAT_COLORS[v.cat]||'pill-gray'}">${v.cat}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
    <td style="text-align:center">${v.miesiacePodatku||12}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--text2)">${v.rate?v.rate.toLocaleString('pl-PL')+' zł':'—'}</td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--green)">${v.amount>0?fmt2(v.amount)+' zł':'—'}</td>
  </tr>`).join('');

  const total = totalTax();
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const taxable = selT.filter(v=>v.cat);
  document.getElementById('ks-count').textContent = selT.length;
  document.getElementById('ks-taxable').textContent = taxable.length;
  document.getElementById('ks-att').textContent = Math.ceil(taxable.length/3)||0;
  document.getElementById('ks-total').textContent = fmt2(total)+' zł';
  document.getElementById('ks-r1').textContent = fmtZl(r1)+' zł';
  document.getElementById('ks-r2').textContent = fmtZl(r2)+' zł';

  // Cat table
  const cats = {};
  selT.forEach(v=>{ if(!v.cat)return; if(!cats[v.cat])cats[v.cat]={count:0,amount:0,rate:v.rate}; cats[v.cat].count++;cats[v.cat].amount+=v.amount; });
  const catEl = document.getElementById('cat-tbody');
  if(catEl) catEl.innerHTML = Object.entries(cats).map(([cat,d])=>`<tr>
    <td><span class="pill ${CAT_COLORS[cat]||'pill-gray'}">${cat}</span></td>
    <td>${CAT_LABELS[cat]||''}</td>
    <td style="text-align:center;font-weight:600">${d.count}</td>
    <td style="text-align:right;font-family:var(--mono);color:var(--text2)">${d.rate?d.rate.toLocaleString('pl-PL')+' zł':'—'}</td>
    <td style="text-align:right;font-family:var(--mono);font-weight:600;color:var(--green)">${fmt2(d.amount)} zł</td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:1rem">Brak pojazdów z kategorią</td></tr>';
}

// ==================== D1 BULK SYNC ====================
async function bulkSyncToD1() {
  if (!window.TaxOrderFleetCloud?.saveVehicles) {
    toast('⚠ Brak połączenia z Cloudflare — zaloguj się najpierw');
    return;
  }
  const btn = document.getElementById('d1-sync-btn');
  const log = document.getElementById('d1-sync-log');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Synchronizuję...'; }

  const BATCH = 50;
  const all = vehs.filter(v => v.nrRej);
  let saved = 0, failed = 0;
  const lines = [];

  const logLine = msg => {
    lines.push(msg);
    if (log) log.innerHTML = lines.slice(-10).join('<br>');
  };

  logLine(`▶ Start synchronizacji ${all.length} pojazdów (partie po ${BATCH})...`);

  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const batchNum = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(all.length / BATCH);
    logLine(`⏳ Partia ${batchNum}/${totalBatches}: ${batch[0].nrRej}…${batch[batch.length-1].nrRej}`);
    try {
      const r = await window.TaxOrderFleetCloud.saveVehicles(batch);
      if (r.ok) { saved += batch.length; logLine(`✅ Partia ${batchNum}: OK (${batch.length} poj.)`); }
      else       { failed += batch.length; logLine(`⚠ Partia ${batchNum}: błąd`); }
    } catch (e) {
      failed += batch.length;
      logLine(`❌ Partia ${batchNum}: ${e.message}`);
    }
  }

  logLine(`─────────────────────────────────`);
  logLine(`✔ Zakończono: ${saved} zapisanych, ${failed} błędów`);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-cloud-upload"></i>Synchronizuj wszystkie pojazdy do D1'; }
  toast(failed === 0 ? `✅ Zsynchronizowano ${saved} pojazdów z D1` : `⚠ ${saved} OK · ${failed} błędów — sprawdź log`);
}

async function checkD1Status() {
  const log = document.getElementById('d1-sync-log');
  if (log) log.innerHTML = '⏳ Sprawdzam stan bazy D1...';
  try {
    const cloud = window.TaxOrderFleetCloud;
    if (!cloud?.loadVehicles) throw new Error('Brak połączenia z Cloudflare');
    const companyId = window.currentCompanyId || 'mtoilet';
    const r = await cloud.loadVehicles(companyId);
    const count = (r?.vehicles || r?.length || 0);
    const localCount = vehs.length;
    if (log) log.innerHTML = `📊 D1: ${typeof count === 'number' ? count + ' pojazdów' : 'odpowiedź OK'} | Lokalnie: ${localCount} pojazdów | ${typeof count === 'number' && count < localCount ? '⚠ D1 ma mniej rekordów — zalecana synchronizacja' : '✅ Baza wygląda OK'}`;
  } catch (e) {
    if (log) log.innerHTML = `❌ Błąd: ${esc(e.message)}`;
  }
}

// ==================== CSV EXPORT ====================
function exportFleetCSV() {
  const HEADERS = [
    'Nr rej.','Marka','Model','Rok','Typ','DMC (kg)','Status','VIN',
    'Kierowca','Stan km','Karta flotowa',
    'OC - Nr polisy','OC - Towarzystwo','OC - Od','OC - Do (RRRR-MM-DD)','OC - Składka zł',
    'AC - Nr polisy','AC - Towarzystwo','AC - Od','AC - Do (RRRR-MM-DD)','AC - Składka zł',
    'Assist - Nr polisy','Assist - Towarzystwo','Assist - Do',
    'Przegląd - Ostatni','Przegląd - Następny','Przegląd - Wynik','Przegląd - Stacja',
    'UDT - Urządzenie','UDT - Nr urządzenia','UDT - Nr decyzji','UDT - Ostatnie','UDT - Następne','UDT - Wynik',
    'Tacho - Nr','Tacho - Ostatnia legalizacja','Tacho - Następna legalizacja',
    'Kat.pojazdu','Paliwo','Ładowność (kg)','Masa własna (kg)','Norma (l/100km)',
    'Właściciel','Osie','Zawieszenie','Ownership','Mies. podatku','Kod wewnętrzny'
  ];
  const list = filterVeh();
  const rows = list.map(v => [
    v.nrRej||'', v.marka||'', v.model||'', v.rok||'', v.typ||'',
    (v.dmc||v.dmcMax||''), v.status||'', v.vin||'',
    v.kierowca||'', v.stanKilometrow||'', v.kartaOrlen||'',
    v.ocPolicyNo||'', v.ocInsurer||'', v.ocStart||'', v.ocEnd||'', v.ocPremium||'',
    v.acPolicyNo||'', v.acInsurer||'', v.acStart||'', v.acEnd||'', v.acPremium||'',
    v.assPolicyNo||'', v.assInsurer||'', v.assEnd||'',
    v.lastInspection||'', v.nextInspection||'', v.inspectionResult||'', v.inspectionStation||'',
    v.udtDeviceType||'', v.udtDeviceNo||'', v.udtCertNo||'', v.udtLastDate||'', v.udtNextDate||'', v.udtResult||'',
    v.tachoNo||'', v.tachoLastCalib||'', v.tachoNextCalib||'',
    (v.katPojazdu||v.kategoria)||'', v.paliwo||'', v.ladownosc||'', (v.masaWlasna??v.masaWlKg)||'', v.normaSpalania||'',
    v.wlasciciel||'', v.osie||'', v.zawieszenie||'',
    v.ownership_type||'', v.miesiacePodatku||12, v.assetCode||''
  ]);
  const csv = [HEADERS, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flota_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`✅ Wyeksportowano ${list.length} pojazdów do CSV`);
}

// ==================== EKSPORT — ROZSZERZENIA ====================

function exportVehicleListPdf() {
  const jsPDFCls = (window.jspdf?.jsPDF) || window.jsPDF;
  if (!jsPDFCls) { toast('⚠ Brak jsPDF — odśwież stronę'); return; }
  const list = filterVeh();
  if (!list.length) { toast('Brak pojazdów do eksportu'); return; }
  const doc = new jsPDFCls({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const company = typeof getCurrentCompany === 'function' ? getCurrentCompany() : {};
  doc.setFontSize(14);
  doc.text('Lista pojazdów — ' + (company.name || ''), 14, 15);
  doc.setFontSize(9);
  doc.text('Wygenerowano: ' + new Date().toLocaleString('pl-PL'), 14, 22);
  doc.autoTable({
    startY: 26,
    head: [['Nr rej.','Marka','Model','Rok','Typ','DMC (kg)','Status','Kierowca','VIN']],
    body: list.map(v => [
      v.nrRej||'', v.marka||'', v.model||'', v.rok||'', v.typ||'',
      v.dmc??v.dmcMax??'', v.status||'', v.kierowca||'', v.vin||''
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });
  doc.save(`lista_pojazdow_${new Date().toISOString().slice(0,10)}.pdf`);
  toast(`✅ PDF z ${list.length} pojazdami pobrano`);
}

function exportServiceHistoryCsv() {
  const list = window.vehs || [];
  const HEADERS = ['Nr rej.','Marka','Model','Data','Typ usługi','Opis','Przebieg (km)','Koszt (zł)'];
  const rows = [];
  list.forEach(v => {
    (v.serviceHistory || []).forEach(s => {
      const typeLabel = window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label || s.type || '';
      rows.push([
        v.nrRej||'', v.marka||'', v.model||'',
        s.date||'', typeLabel, s.description||'',
        s.km != null ? s.km : '', s.cost != null ? (+s.cost).toFixed(2) : ''
      ]);
    });
  });
  if (!rows.length) { toast('Brak historii serwisowej do eksportu'); return; }
  const csv = [HEADERS, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historia_serwisow_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`✅ Wyeksportowano ${rows.length} wpisów serwisowych do CSV`);
}

function exportFinesCsv() {
  const fines = window.TaxOrderFines?.getAllSync() || [];
  if (!fines.length) { toast('Brak mandatów do eksportu'); return; }
  const FINE_TYPES = window.TaxOrderFines?.FINE_TYPES || {};
  const HEADERS = ['Nr rej.','Kierowca','Data','Typ','Kwota (zł)','Termin płatności','Zapłacono','Data zapłaty','Opis','Nr mandatu','Wystawił','Punkty'];
  const rows = fines.map(f => [
    f.nr_rej||'', f.driver_name||'', f.date||'',
    FINE_TYPES[f.type]?.label || f.type || '',
    f.amount != null ? f.amount : '', f.deadline||'',
    f.paid ? 'TAK' : 'NIE', f.paid_date||'',
    f.description||'', f.fine_no||'', f.issuer||'', f.points||''
  ]);
  const csv = [HEADERS, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mandaty_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`✅ Wyeksportowano ${fines.length} mandatów do CSV`);
}

// ==================== EKSPORT TCO ====================

function exportTcoCsv() {
  const yr = String(new Date().getFullYear());
  const list = filterVeh();
  if (!list.length) { toast('Brak pojazdów do eksportu'); return; }
  const HEADERS = ['Nr rej.','Marka','Model','Rok','Typ','Kierowca',
    'OC składka (zł/rok)','AC składka (zł/rok)','Leasing łączny (zł/rok)',
    `Paliwo ${yr} (zł)`,`Serwis ${yr} (zł)`,`TCO ${yr} (zł)`,
    'Śr. spalanie (l/100km)','Kat. DT-1','Podatek DT-1 (zł/rok)'];

  const rows = list.map(v => {
    const tax = typeof calcTax === 'function' ? calcTax(v) : {};
    const ocZl     = +(v.ocPremium) || 0;
    const acZl     = +(v.acPremium) || 0;
    const leasingZl = v.leasingRate ? +(v.leasingRate) * 12 : 0;
    const fuelZl   = (v.fuelHistory  ||[]).filter(h=>(h.date||'').startsWith(yr)).reduce((s,h)=>s+(h.totalGross||0),0);
    const serwisZl = (v.serviceHistory||[]).filter(h=>(h.date||'').startsWith(yr)).reduce((s,h)=>s+(+h.cost||0),0);
    const tco = ocZl + acZl + leasingZl + fuelZl + serwisZl;
    // Average fuel efficiency
    const fh = [...(v.fuelHistory||[])].filter(x=>x.km>0&&x.liters>0).sort((a,b)=>a.km-b.km);
    let fl=0,fk=0,fn=0;
    for(let i=1;i<fh.length;i++){const d=fh[i].km-fh[i-1].km;if(d>10&&d<5000){fl+=fh[i].liters;fk+=d;fn++;}}
    const avgFuel = fn>=2&&fk>0?(fl/fk*100).toFixed(1):'';
    return [
      v.nrRej||'',v.marka||'',v.model||'',v.rok||'',v.typ||'',v.kierowca||'',
      ocZl.toFixed(2),acZl.toFixed(2),leasingZl.toFixed(2),
      fuelZl.toFixed(2),serwisZl.toFixed(2),tco.toFixed(2),
      avgFuel, tax.cat||v.cat||'', tax.amount!=null?Math.round(tax.amount):''
    ];
  });
  const csv = [HEADERS,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`tco_${yr}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast(`✅ Raport TCO ${yr} dla ${list.length} pojazdów`);
}

// ==================== ALERT BANNER ====================

function _renderAlertBanner() {
  const el = document.getElementById('fleet-alert-banner');
  if (!el || !vehs.length) return;
  const now = new Date(); now.setHours(0,0,0,0);
  const _d = ds => { if(!ds) return null; const d=new Date(ds+'T00:00:00'); return isNaN(d)?null:Math.round((d-now)/86400000); };
  const expired = vehs.filter(v=>[v.ocEnd,v.acEnd,v.nextInspection].some(ds=>{const d=_d(ds);return d!==null&&d<0;}));
  const soon30  = vehs.filter(v=>!expired.includes(v)&&[v.ocEnd,v.acEnd,v.nextInspection].some(ds=>{const d=_d(ds);return d!==null&&d>=0&&d<=30;}));
  if(!expired.length&&!soon30.length){el.style.display='none';el.innerHTML='';return;}
  el.style.display='flex';
  el.innerHTML=`
    ${expired.length?`<div class="fleet-alert-chip fleet-alert-red" onclick="document.getElementById('f-alert').value='expired';renderVeh();" title="Kliknij aby odfiltrować">
      <i class="ti ti-alert-circle"></i><strong>${expired.length}</strong> wygasłe OC/AC/przegląd
    </div>`:''}
    ${soon30.length?`<div class="fleet-alert-chip fleet-alert-amber" onclick="document.getElementById('f-alert').value='alert';renderVeh();" title="Kliknij aby odfiltrować">
      <i class="ti ti-alert-triangle"></i><strong>${soon30.length}</strong> terminów OC/AC/przegląd ≤ 30 dni
    </div>`:''}`;
}

// ==================== MASOWA EDYCJA POLA ====================

function bulkEditField() {
  const sel = getSel();
  if (!sel.length) { toast('Zaznacz pojazdy do edycji'); return; }
  const modal = document.getElementById('bulk-edit-modal');
  if (modal) {
    document.getElementById('bulk-edit-count').textContent = sel.length;
    modal.style.display = 'flex';
  }
}

function bulkEditApply() {
  const sel = getSel();
  const fieldKey = document.getElementById('bulk-edit-field')?.value;
  const newVal   = document.getElementById('bulk-edit-value')?.value?.trim();
  if (!fieldKey || !sel.length) return;

  const parsed = fieldKey === 'miesiacePodatku' ? (parseInt(newVal)||12) :
                 fieldKey === 'normaSpalania'    ? (parseFloat(newVal.replace(',','.'))||null) :
                 (newVal||null);

  sel.forEach(v => {
    if (parsed !== null && parsed !== undefined) v[fieldKey] = parsed;
    window.TaxOrderFleetCloud?.saveVehicle?.(v);
  });
  document.getElementById('bulk-edit-modal').style.display = 'none';
  renderVeh(); updateCounters();
  toast(`✓ Zaktualizowano "${fieldKey}" dla ${sel.length} pojazdów`);
}

// ==================== PANEL KIEROWCÓW ====================

function _renderDriverPanel() {
  const el = document.getElementById('fleet-driver-panel');
  if (!el) return;
  const now = new Date(); now.setHours(0,0,0,0); const DAYS30=30*86400000;
  const map = {};
  vehs.forEach(v => {
    const key = v.kierowca || '— bez kierowcy —';
    if (!map[key]) map[key] = {name:key, vehs:[], alerts:0, fl:0, fk:0, fn:0};
    const d = map[key];
    d.vehs.push(v);
    if ([v.ocEnd,v.acEnd,v.nextInspection].some(ds=>ds&&(new Date(ds+'T00:00:00')-now)<DAYS30&&(new Date(ds+'T00:00:00')-now)>=-86400000)) d.alerts++;
    const fh=[...(v.fuelHistory||[])].filter(x=>x.km>0&&x.liters>0).sort((a,b)=>a.km-b.km);
    for(let i=1;i<fh.length;i++){const dk=fh[i].km-fh[i-1].km;if(dk>10&&dk<5000){d.fl+=fh[i].liters;d.fk+=dk;d.fn++;}}
  });
  const list = Object.values(map).sort((a,b)=>b.vehs.length-a.vehs.length);
  const active = window._driverFilter;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase">Kierowcy (${list.length})</div>
      ${active?`<button class="btn btn-gray" style="font-size:11px;padding:3px 8px" onclick="window._driverFilter=null;renderVeh()"><i class="ti ti-filter-off"></i>Pokaż wszystkich</button>`:''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
      ${list.map(d=>{
        const avgFuel=d.fn>=2&&d.fk>0?(d.fl/d.fk*100).toFixed(1):null;
        const isActive=active===d.name||(active===''&&d.name==='— bez kierowcy —');
        return `<div style="background:var(--bg2);border:1px solid ${isActive?'var(--blue)':'var(--border)'};border-radius:var(--radius);padding:10px;cursor:pointer;${isActive?'box-shadow:0 0 0 2px var(--blue-light)':''}"
          data-driver="${esc(d.name)}" onclick="TaxOrderVehicleDetail?._driverPanelClick?.(this.dataset.driver)">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <i class="ti ti-user-circle" style="color:var(--blue);font-size:16px"></i>
            <span style="font-weight:600;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px">${esc(d.name)}</span>
            ${d.alerts?`<span class="pill pill-amber" style="margin-left:auto;font-size:9px">${d.alerts}⚠</span>`:''}
          </div>
          <div style="font-size:10px;color:var(--text2)">
            <div><i class="ti ti-truck" style="font-size:10px;margin-right:3px"></i>${d.vehs.length} poj.</div>
            ${avgFuel?`<div><i class="ti ti-gas-station" style="font-size:10px;margin-right:3px"></i>${avgFuel} l/100km</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  window.TaxOrderVehicleDetail._driverPanelClick = (name) => {
    const raw = (name === '— bez kierowcy —') ? '' : name;
    window._driverFilter = (window._driverFilter === raw) ? null : raw;
    renderVeh();
  };
}

// ==================== WIDOK KALENDARZA ====================

function _renderCalendarView() {
  const el = document.getElementById('fleet-calendar');
  if (!el) return;
  const now = new Date(); const yr=now.getFullYear(); const mo=now.getMonth();
  const todayStr = now.toISOString().slice(0,10);
  const events = {};
  vehs.forEach(v=>{
    const add=(ds,label,color)=>{
      if(!ds)return; const key=ds.slice(0,10);
      if(!events[key])events[key]=[];
      events[key].push({nrRej:v.nrRej,label,color});
    };
    add(v.ocEnd,'OC','#dc2626'); add(v.acEnd,'AC','#d97706');
    add(v.nextInspection,'Prz','#2563eb'); add(v.leasingEnd,'Lea','#7c3aed');
  });

  const DN=['Pn','Wt','Śr','Cz','Pt','So','Nd'];
  let html=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px">`;

  for(let m=0;m<3;m++){
    const tMo=(mo+m)%12, tYr=yr+Math.floor((mo+m)/12);
    const first=new Date(tYr,tMo,1), last=new Date(tYr,tMo+1,0);
    const offset=(first.getDay()+6)%7;
    const monthLabel=first.toLocaleDateString('pl-PL',{month:'long',year:'numeric'});
    const pfx=`${tYr}-${String(tMo+1).padStart(2,'0')}`;
    const monthEvents=Object.keys(events).filter(k=>k.startsWith(pfx)).reduce((s,k)=>s+events[k].length,0);

    html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
      <div style="display:flex;align-items:center;margin-bottom:10px">
        <strong style="font-size:12px;text-transform:capitalize">${monthLabel}</strong>
        ${monthEvents?`<span class="pill pill-amber" style="margin-left:auto;font-size:10px">${monthEvents} terminów</span>`:'<span style="font-size:10px;color:var(--text3);margin-left:auto">brak terminów</span>'}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">
        ${DN.map(d=>`<div style="font-size:9px;font-weight:600;color:var(--text3);text-align:center;padding:2px">${d}</div>`).join('')}
        ${Array(offset).fill('<div></div>').join('')}
        ${Array.from({length:last.getDate()},(_,i)=>{
          const day=i+1;
          const ds=`${pfx}-${String(day).padStart(2,'0')}`;
          const ev=events[ds]||[];
          const isToday=ds===todayStr;
          return `<div style="min-height:30px;border:1px solid ${isToday?'var(--blue)':'var(--border)'};border-radius:3px;padding:1px;background:${isToday?'var(--blue-light,#eff6ff)':'transparent'}">
            <div style="font-size:9px;text-align:right;color:${isToday?'var(--blue)':'var(--text3)'}${ev.length?';font-weight:700':''}">${day}</div>
            ${ev.slice(0,2).map(e=>`<div style="font-size:8px;background:${e.color};color:#fff;border-radius:2px;padding:0 2px;line-height:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="${esc(e.nrRej)} — ${e.label}">${esc(e.nrRej.slice(0,6))}</div>`).join('')}
            ${ev.length>2?`<div style="font-size:8px;color:var(--text3)">+${ev.length-2}</div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
  html+=`</div><div style="display:flex;gap:12px;margin-top:12px;font-size:11px;flex-wrap:wrap">
    ${[['#dc2626','OC'],['#d97706','AC'],['#2563eb','Przegląd SKP'],['#7c3aed','Leasing']].map(([c,l])=>
      `<span><span style="display:inline-block;width:10px;height:10px;background:${c};border-radius:2px;margin-right:4px;vertical-align:middle"></span>${l}</span>`
    ).join('')}
  </div>`;
  el.innerHTML=html;
}

// ==================== ANALIZA SPALANIA PER KIEROWCA ====================

function showFuelByDriver() {
  const map = {};
  vehs.forEach(v=>{
    const key = v.kierowca || '— bez kierowcy —';
    if(!map[key])map[key]={name:key,fl:0,fk:0,fn:0,vehs:0};
    map[key].vehs++;
    const fh=[...(v.fuelHistory||[])].filter(x=>x.km>0&&x.liters>0).sort((a,b)=>a.km-b.km);
    for(let i=1;i<fh.length;i++){const d=fh[i].km-fh[i-1].km;if(d>10&&d<5000){map[key].fl+=fh[i].liters;map[key].fk+=d;map[key].fn++;}}
  });
  const ranked = Object.values(map).filter(d=>d.fn>=2).sort((a,b)=>(a.fl/a.fk)-(b.fl/b.fk));
  if(!ranked.length){toast('Brak danych tankowania do analizy');return;}

  const avg = ranked.reduce((s,d)=>s+(d.fl/d.fk),0)/ranked.length*100;
  const modal = document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:5500;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML=`
    <div style="background:var(--bg);border-radius:var(--radius-lg);width:min(520px,100%);box-shadow:0 8px 40px rgba(0,0,0,.3);overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border)">
        <i class="ti ti-gas-station" style="font-size:20px;color:var(--blue)"></i>
        <strong style="font-size:15px">Spalanie per kierowca (l/100km)</strong>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:22px;color:var(--text2)">×</button>
      </div>
      <div style="padding:16px;overflow-y:auto;max-height:70vh">
        <div style="font-size:11px;color:var(--text2);margin-bottom:12px">Średnia floty: <strong>${avg.toFixed(1)} l/100km</strong> · posortowani od najoszczędniejszego</div>
        ${ranked.map((d,i)=>{
          const val=(d.fl/d.fk*100);
          const pct=Math.round(val/avg*100);
          const color=val<avg*0.9?'var(--green,#22c55e)':val>avg*1.1?'var(--red,#ef4444)':'var(--amber,#f59e0b)';
          return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border)">
            <span style="min-width:20px;font-size:11px;color:var(--text3);text-align:right">${i+1}.</span>
            <span style="flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.name)}</span>
            <span style="font-size:10px;color:var(--text2)">${d.vehs} poj.</span>
            <div style="width:80px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${Math.min(pct,150)}%;background:${color};border-radius:3px"></div>
            </div>
            <strong style="font-size:13px;min-width:50px;text-align:right;color:${color}">${val.toFixed(1)}</strong>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  modal.addEventListener('click',e=>{if(e.target===modal)modal.remove();});
  document.body.appendChild(modal);
}

// ==================== ZAPISANE FILTRY ====================

const _SAVED_FILTERS_LS = 'taxorder-saved-filters';
let _savedFilters = (() => { try{return JSON.parse(localStorage.getItem(_SAVED_FILTERS_LS))||[];}catch{return[];} })();

function saveCurrentFilter() {
  const name = prompt('Nazwa dla tego zestawu filtrów:');
  if (!name?.trim()) return;
  const q = document.getElementById('q-veh')?.value||'';
  const fTyp = document.getElementById('f-typ')?.value||'';
  const fStat = document.getElementById('f-status')?.value||'';
  const fWl = document.getElementById('f-wl')?.value||'';
  const fAlert = document.getElementById('f-alert')?.value||'';
  const entry = { id: Date.now(), name: name.trim(), q, fTyp, fStat, fWl, fAlert, dateFilters: {..._dateFilters} };
  _savedFilters = _savedFilters.filter(f=>f.name!==entry.name);
  _savedFilters.unshift(entry);
  if (_savedFilters.length > 20) _savedFilters.pop();
  try{localStorage.setItem(_SAVED_FILTERS_LS, JSON.stringify(_savedFilters));}catch{}
  _renderSavedFiltersList();
  toast(`✓ Zapisano filtr „${esc(entry.name)}"`);
}

function loadSavedFilter(id) {
  const f = _savedFilters.find(x=>x.id===id);
  if (!f) return;
  const setV = (elId, val) => { const el=document.getElementById(elId); if(el) el.value=val||''; };
  setV('q-veh', f.q); setV('f-typ', f.fTyp); setV('f-status', f.fStat); setV('f-wl', f.fWl); setV('f-alert', f.fAlert);
  if (f.dateFilters) {
    _dateFilters = {..._dateFilters, ...f.dateFilters};
    document.querySelectorAll('.date-filter-input').forEach(el => {
      const field = el.getAttribute('oninput')?.match(/applyDateFilter\('(\w+)'/)?.[1];
      if (field && _dateFilters[field] !== undefined) el.value = _dateFilters[field];
    });
  }
  _vehPage = 0; renderVeh();
  document.getElementById('saved-filters-dropdown')?.classList.remove('open');
}

function deleteSavedFilter(id) {
  _savedFilters = _savedFilters.filter(x=>x.id!==id);
  try{localStorage.setItem(_SAVED_FILTERS_LS, JSON.stringify(_savedFilters));}catch{}
  _renderSavedFiltersList();
}

function _renderSavedFiltersList() {
  const el = document.getElementById('saved-filters-list');
  if (!el) return;
  if (!_savedFilters.length) { el.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--text3)">Brak zapisanych filtrów</div>'; return; }
  el.innerHTML = _savedFilters.map(f=>`
    <div style="display:flex;align-items:center;gap:4px;padding:5px 8px;border-radius:var(--radius-sm);cursor:pointer" onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background='transparent'">
      <button onclick="loadSavedFilter(${f.id})" style="flex:1;background:none;border:none;cursor:pointer;text-align:left;font-size:12px;color:var(--text);padding:0">${esc(f.name)}</button>
      <button onclick="event.stopPropagation();deleteSavedFilter(${f.id})" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:14px;padding:0 2px;line-height:1" title="Usuń">×</button>
    </div>`).join('');
}

function toggleSavedFiltersPanel() {
  const panel = document.getElementById('saved-filters-dropdown');
  if (!panel) return;
  const open = panel.style.display !== 'block';
  panel.style.display = open ? 'block' : 'none';
  if (open) _renderSavedFiltersList();
}

// ==================== WALIDACJA VIN (ISO 3779) ====================
const _VIN_TRANS = {A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9,'0':0,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9};
const _VIN_W    = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

function _validateVin(vin) {
  if (!vin) return { valid:false, reason:'brak VIN' };
  const v = String(vin).toUpperCase().replace(/[\s\-]/g,'');
  if (v.length !== 17) return { valid:false, reason:`${v.length}/17 znaków` };
  if (/[IOQ]/.test(v)) return { valid:false, reason:'niedozwolone I/O/Q' };
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const val = _VIN_TRANS[v[i]];
    if (val === undefined) return { valid:false, reason:`znak "${v[i]}"` };
    sum += val * _VIN_W[i];
  }
  const rem   = sum % 11;
  const check = rem === 10 ? 'X' : String(rem);
  if (v[8] !== check) return { valid:false, reason:`cyfra kont. ${v[8]}≠${check}` };
  return { valid:true };
}

function _vinCell(v) {
  if (!v.vin) return '<span style="color:var(--text3)">—</span>';
  const r = _validateVin(v.vin);
  if (r.valid) return `<span style="color:var(--text2);font-size:11px;font-family:var(--mono)">${esc(v.vin)}</span>`;
  return `<span style="font-size:11px;font-family:var(--mono);color:var(--red)" title="⚠ VIN: ${esc(r.reason)}">${esc(v.vin)} ⚠</span>`;
}

// ==================== DT-1 COMPLETENESS ====================
// Zwraca { score:0-100, missing:['VIN',...], ok:bool }
function _dt1Completeness(v) {
  const fields = [
    { key: 'vin',             label: 'VIN',           check: v => v.vin && v.vin.length >= 5 },
    { key: 'dmc',             label: 'DMC',           check: v => (v.dmc||v.dmcMax||0) > 0 },
    { key: 'osie',            label: 'Osie',          check: v => v.osie > 0 },
    { key: 'zawieszenie',     label: 'Zawieszenie',   check: v => !!v.zawieszenie },
    { key: 'dataRejestracji', label: 'Data 1. rej.',  check: v => !!(v.dataRejestracji||v.dataRej) },
    { key: 'rok',             label: 'Rok prod.',     check: v => !!v.rok },
    { key: 'paliwo',          label: 'Paliwo',        check: v => !!v.paliwo },
    { key: 'wlasciciel',      label: 'Właściciel',    check: v => !!v.wlasciciel },
    { key: 'miesiacePodatku', label: 'Miesiące',      check: v => (v.miesiacePodatku||0) > 0 },
  ];
  const missing = fields.filter(f => !f.check(v)).map(f => f.label);
  const score   = Math.round((fields.length - missing.length) / fields.length * 100);
  const cat     = calcTax(v).cat;
  return { score, missing, ok: missing.length === 0 && !!cat, hasCat: !!cat };
}

function _dt1CompletenessCell(v) {
  const { score, missing, ok, hasCat } = _dt1Completeness(v);
  if (ok) return `<span title="Kompletne dane DT-1" style="color:var(--green);font-size:16px">✓</span>`;
  const color = score >= 80 ? 'var(--amber)' : 'var(--red)';
  const tip   = missing.length ? `Brakuje: ${missing.join(', ')}${!hasCat?' + brak kategorii':''}` : 'Brak kategorii DT-1';
  return `<span title="${tip}" style="cursor:help">
    <span style="font-size:10px;font-weight:700;color:${color}">${score}%</span>
    ${!hasCat ? '<span style="font-size:9px;color:var(--red)"> kat?</span>' : ''}
  </span>`;
}

// ==================== AUTO-KATEGORIA DT-1 ====================
// ── Kalkulator miesięcy z daty nabycia/zbycia ────────────────────────────
function _pickMiesiace(vehId) {
  const v = (window.vehs||[]).find(x=>x.id===vehId); if(!v) return;
  let pop = document.getElementById('pick-mies-pop');
  if (pop) pop.remove();
  pop = document.createElement('div');
  pop.id = 'pick-mies-pop';
  pop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:center;justify-content:center';
  pop.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-lg);padding:24px;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.35)">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">📅 Oblicz miesiące — ${esc(v.nrRej)}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px">Wybierz typ zdarzenia i datę — liczba miesięcy zostanie obliczona automatycznie.</div>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Zdarzenie:</label>
      <select id="pm-typ" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;margin-bottom:10px">
        <option value="nabycie">Nabycie w trakcie roku (obowiązek od tego miesiąca)</option>
        <option value="zbycie">Zbycie / wygaśnięcie (obowiązek do tego miesiąca)</option>
      </select>
      <label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px">Data zdarzenia:</label>
      <input type="date" id="pm-data" style="width:100%;padding:7px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;margin-bottom:10px" value="${(d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'))(new Date())}">
      <div id="pm-result" style="font-size:13px;font-weight:600;color:var(--green);margin-bottom:14px;min-height:20px"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-green" style="flex:1;justify-content:center" onclick="_applyMiesiace(${vehId})"><i class="ti ti-check"></i>Zastosuj</button>
        <button class="btn btn-gray" onclick="document.getElementById('pick-mies-pop').remove()">Anuluj</button>
      </div>
    </div>`;
  document.body.appendChild(pop);
  pop.addEventListener('click', e => { if(e.target===pop) pop.remove(); });
  // Auto-oblicz przy zmianie
  pop.querySelectorAll('#pm-typ,#pm-data').forEach(el => el.addEventListener('change', _calcMiesiace));
  _calcMiesiace();
}

function _calcMiesiace() {
  const typ  = document.getElementById('pm-typ')?.value;
  const data = document.getElementById('pm-data')?.value;
  const res  = document.getElementById('pm-result');
  if (!data || !res) return;
  const m = new Date(data).getMonth() + 1; // 1-12
  let mies, info;
  if (typ === 'nabycie') {
    mies = Math.max(1, 13 - m);
    info = `Nabycie w miesiącu ${m} → obowiązek przez ${mies} mies. (${m}–12)`;
  } else {
    mies = Math.max(1, m);
    info = `Zbycie w miesiącu ${m} → obowiązek przez ${mies} mies. (1–${m})`;
  }
  res.textContent = info;
  res.dataset.mies = mies;
}

function _applyMiesiace(vehId) {
  const res  = document.getElementById('pm-result');
  const mies = parseInt(res?.dataset?.mies);
  if (!mies || mies < 1 || mies > 12) { toast('⚠ Nieprawidłowa liczba miesięcy'); return; }
  setV(vehId, 'miesiacePodatku', mies);
  toast(`✓ Miesiące: ${mies}`);
  document.getElementById('pick-mies-pop')?.remove();
}

function autoAssignCategories() {
  const nocat = (window.vehs || []).filter(v => !v.cat && !calcTax(v).cat);
  if (!nocat.length) { toast('✓ Wszystkie pojazdy mają kategorię DT-1'); return; }

  let assigned = 0;
  (window.vehs || []).forEach(v => {
    const t = calcTax(v);
    if (t.cat && !v.cat) { v.cat = t.cat; v.amount = t.amount; assigned++; }
  });

  renderVeh(); updateCounters();
  if (assigned) {
    toast(`✓ Auto-przypisano kategorię DT-1 dla ${assigned} pojazdów`);
    if (window.TaxOrderFleetCloud?.saveVehicles) {
      const toSave = (window.vehs||[]).filter(v => v.cat && v.dbId);
      window.TaxOrderFleetCloud.saveVehicles(toSave);
    }
  } else {
    toast(`⚠ ${nocat.length} pojazdów bez kategorii — uzupełnij DMC i osie`);
  }
}

// ==================== DT-1 PER FIRMA ====================
async function generujDt1PerFirma() {
  if (typeof DT1Generator === 'undefined') { toast('⚠ Moduł DT1Generator niedostępny'); return; }

  const tp = id => (document.getElementById(id)||{}).value || '';
  const co = typeof getCurrentCompany === 'function' ? getCurrentCompany() : {};
  const yr = parseInt(tp('taxYearDT1') || new Date().getFullYear());

  // Grupuj pojazdy wg właściciela (wlasciciel)
  const groups = {};
  (window.vehs || []).forEach(v => {
    const t = calcTax(v);
    if (!t.cat) return;
    const owner = (v.wlasciciel || co.name || 'Flota').trim();
    if (!groups[owner]) groups[owner] = [];
    groups[owner].push({ ...v, ...t });
  });

  const owners = Object.keys(groups);
  if (!owners.length) { toast('⚠ Brak pojazdów opodatkowanych — uzupełnij dane DT-1'); return; }

  if (owners.length === 1) {
    toast(`ℹ Tylko jeden właściciel (${owners[0]}) — użyj "Generuj PDF (cała flota)"`);
    return;
  }

  toast(`⏳ Generuję ${owners.length} deklaracji DT-1...`);

  const baseTaxpayer = {
    nip:    tp('tp-nip')  || co.nip  || '',
    organ:  tp('tp-organ')|| co.organ|| '',
    ulica:  tp('tp-ulica')|| '', dom: tp('tp-dom')||'', lokal: tp('tp-lokal')||'',
    kod:    tp('tp-kod')  || '', miasto: tp('tp-miasto')||'', woj: tp('tp-woj')||'',
    imie:   tp('tp-imie') || '', nazwisko: tp('tp-nazwisko')||'',
    cel:    tp('tp-cel')  || 'DEKLARACJA SKLADANA DO 15 LUTEGO',
    rodzajPodatnika: tp('tp-rodzaj') || 'niefizyczny',
  };

  let ok = 0;
  for (const [owner, vehicles] of Object.entries(groups)) {
    try {
      await DT1Generator.generate({ ...baseTaxpayer, nazwa: owner }, vehicles, { rok: yr });
      ok++;
    } catch(e) {
      toast(`⚠ Błąd DT-1 dla "${owner}": ${e.message}`);
    }
  }
  if (ok) toast(`✅ Wygenerowano ${ok} deklaracji DT-1 (po jednej na firmę)`);
}

// ==================== COLUMN VISIBILITY & ORDER ====================
const _COL_ORDER_LS   = 'taxColOrder';
const _COL_PRESETS_LS = 'taxColPresets';
const _COL_FILTERS_LS = 'taxColFilters';

const _COL_ORDER_DEFAULT = [
  'rok','typ','dmc','osie','zawieszenie','dmczesp','mies',
  'status','oc','ac','przeglad','ocInsurer','acInsurer',
  'udt','tacho','kierowca','km','dt1ok','gmina',
  'kategoria','podatek','vin','paliwo','poj','mocKw',
  'masaWl','msc','euro','dmcF2','ladownosc','dataRej','katDR',
];

const _COL_FLEET = {rok:1,typ:1,dmc:0,osie:0,zawieszenie:0,dmczesp:0,mies:0,status:1,oc:1,ac:1,przeglad:1,kategoria:0,podatek:0,ocInsurer:1,acInsurer:0,udt:1,tacho:1,kierowca:1,km:1,dt1ok:0,gmina:0,
  vin:0,paliwo:0,poj:0,mocKw:0,masaWl:0,msc:0,euro:0,dmcF2:0,ladownosc:0,dataRej:0,katDR:0};
const _COL_DT1   = {rok:1,typ:1,dmc:1,osie:1,zawieszenie:1,dmczesp:1,mies:1,status:1,oc:0,ac:0,przeglad:0,kategoria:1,podatek:1,ocInsurer:0,acInsurer:0,udt:0,tacho:0,kierowca:1,km:0,dt1ok:1,gmina:1,
  vin:0,paliwo:0,poj:0,mocKw:0,masaWl:1,msc:0,euro:0,dmcF2:1,ladownosc:1,dataRej:1,katDR:1};
const _COL_DEFAULTS = {..._COL_FLEET};

let _colVis   = null;
let _colOrder = null;
let _viewMode = localStorage.getItem('fleetViewMode') || 'fleet';
let _colFilters = {};
let _filterRowVisible = false;

// ── Nagłówki kolumn ──────────────────────────────────────────────────
const _FLEET_COL_TH = {
  rok:        `<th data-col="rok" class="sort-th" onclick="sortBy('rok')" data-i18n="col.year">Rok</th>`,
  typ:        `<th data-col="typ" class="sort-th" onclick="sortBy('typ')" data-i18n="col.type">Typ</th>`,
  dmc:        `<th data-col="dmc" class="sort-th" onclick="sortBy('dmc')" data-i18n="col.dmc">DMC (kg)</th>`,
  osie:       `<th data-col="osie" data-i18n="col.axles">Osie</th>`,
  zawieszenie:`<th data-col="zawieszenie" data-i18n="col.suspension">Zawieszenie</th>`,
  dmczesp:    `<th data-col="dmczesp" data-i18n="col.dmc.team">DMC zesp. (t)</th>`,
  mies:       `<th data-col="mies" data-i18n="col.months">Mies.</th>`,
  status:     `<th data-col="status" data-i18n="col.status">Status</th>`,
  oc:         `<th data-col="oc" data-i18n="col.oc" title="Ubezpieczenie OC — data ważności">OC</th>`,
  ac:         `<th data-col="ac" data-i18n="col.ac" title="Ubezpieczenie AC — data ważności">AC</th>`,
  przeglad:   `<th data-col="przeglad" data-i18n="col.inspection" title="Następny przegląd techniczny">Przegląd</th>`,
  ocInsurer:  `<th data-col="ocInsurer" data-i18n="col.oc.insurer" title="Ubezpieczyciel OC / nr polisy">Ubezpieczyciel OC</th>`,
  acInsurer:  `<th data-col="acInsurer" data-i18n="col.ac.insurer" title="Ubezpieczyciel AC / nr polisy">Ubezpieczyciel AC</th>`,
  udt:        `<th data-col="udt" data-i18n="col.udt" title="Termin badania UDT">UDT</th>`,
  tacho:      `<th data-col="tacho" data-i18n="col.tacho" title="Termin legalizacji tachografu">Tachograf</th>`,
  kierowca:   `<th data-col="kierowca" class="sort-th" onclick="sortBy('kierowca')" data-i18n="col.driver" title="Przypisany kierowca">Kierowca</th>`,
  km:         `<th data-col="km" class="sort-th" onclick="sortBy('stanKilometrow')" style="text-align:right" data-i18n="col.km" title="Stan licznika km">km</th>`,
  dt1ok:      `<th data-col="dt1ok" style="text-align:center" data-i18n="col.dt1ok" title="Kompletność danych DT-1">DT-1 ✓</th>`,
  gmina:      `<th data-col="gmina" data-i18n="col.gmina" title="Gmina — stawki DT-1">Gmina</th>`,
  kategoria:  `<th data-col="kategoria" data-i18n="col.category">Kategoria</th>`,
  podatek:    `<th data-col="podatek" class="sort-th" onclick="sortBy('podatek')" style="text-align:right" data-i18n="col.tax">Podatek</th>`,
  vin:        `<th data-col="vin" class="sort-th" onclick="sortBy('vin')" title="Numer VIN">VIN</th>`,
  paliwo:     `<th data-col="paliwo" title="Rodzaj paliwa (P.3 DR)">Paliwo</th>`,
  poj:        `<th data-col="poj" class="sort-th" onclick="sortBy('pojSilnika')" style="text-align:right" title="Pojemność silnika (P.1 DR)">Poj. (cm³)</th>`,
  mocKw:      `<th data-col="mocKw" class="sort-th" onclick="sortBy('mocKW')" style="text-align:right" title="Moc silnika (P.2 DR)">Moc (kW)</th>`,
  masaWl:     `<th data-col="masaWl" class="sort-th" onclick="sortBy('masaWlasna')" style="text-align:right" title="Masa własna pojazdu (G DR)">Masa wł. (kg)</th>`,
  msc:        `<th data-col="msc" style="text-align:center" title="Miejsca siedzące (S.1 DR)">Msc.</th>`,
  euro:       `<th data-col="euro" title="Norma emisji EURO">EURO</th>`,
  dmcF2:      `<th data-col="dmcF2" class="sort-th" onclick="sortBy('dmcKg2')" style="text-align:right" title="F.2 — DMC z ładunkiem (kg DR)">F.2 DMC (kg)</th>`,
  ladownosc:  `<th data-col="ladownosc" class="sort-th" onclick="sortBy('ladownosc')" style="text-align:right" title="Ładowność = F.2 − G">Ładowność (kg)</th>`,
  dataRej:    `<th data-col="dataRej" class="sort-th" onclick="sortBy('dataRejestracji')" title="B — Data 1. rejestracji w RP">Data 1. rej.</th>`,
  katDR:      `<th data-col="katDR" title="J — Kategoria pojazdu z DR (N1/N2/N3/O/M)">Kat. DR</th>`,
};

// ── Komórki filtrów ──────────────────────────────────────────────────
const _FLEET_COL_FI = {
  rok:        `<th data-col="rok"><input class="col-fi" type="text" placeholder="⌕ Rok" oninput="applyColFilter('rok',this.value)"></th>`,
  typ:        `<th data-col="typ"><input class="col-fi" type="text" placeholder="⌕ Typ" oninput="applyColFilter('typ',this.value)"></th>`,
  dmc:        `<th data-col="dmc"><input class="col-fi" type="text" placeholder="⌕ DMC" oninput="applyColFilter('dmc',this.value)"></th>`,
  osie:       `<th data-col="osie"></th>`,
  zawieszenie:`<th data-col="zawieszenie"></th>`,
  dmczesp:    `<th data-col="dmczesp"></th>`,
  mies:       `<th data-col="mies"></th>`,
  status:     `<th data-col="status"><input class="col-fi" type="text" placeholder="⌕ Status" oninput="applyColFilter('status',this.value)"></th>`,
  oc:         `<th data-col="oc"><input class="col-fi" type="date" oninput="applyColFilter('oc',this.value)"></th>`,
  ac:         `<th data-col="ac"><input class="col-fi" type="date" oninput="applyColFilter('ac',this.value)"></th>`,
  przeglad:   `<th data-col="przeglad"><input class="col-fi" type="date" oninput="applyColFilter('przeglad',this.value)"></th>`,
  ocInsurer:  `<th data-col="ocInsurer"><input class="col-fi" type="text" placeholder="⌕ OC" oninput="applyColFilter('ocInsurer',this.value)"></th>`,
  acInsurer:  `<th data-col="acInsurer"><input class="col-fi" type="text" placeholder="⌕ AC" oninput="applyColFilter('acInsurer',this.value)"></th>`,
  udt:        `<th data-col="udt"></th>`,
  tacho:      `<th data-col="tacho"></th>`,
  kierowca:   `<th data-col="kierowca"><input class="col-fi" type="text" placeholder="⌕ Kierowca" oninput="applyColFilter('kierowca',this.value)"></th>`,
  km:         `<th data-col="km"></th>`,
  dt1ok:      `<th data-col="dt1ok"></th>`,
  gmina:      `<th data-col="gmina"></th>`,
  kategoria:  `<th data-col="kategoria"></th>`,
  podatek:    `<th data-col="podatek"></th>`,
  vin:        `<th data-col="vin"><input class="col-fi" type="text" placeholder="⌕ VIN" oninput="applyColFilter('vin',this.value)"></th>`,
  paliwo:     `<th data-col="paliwo"><input class="col-fi" type="text" placeholder="⌕" oninput="applyColFilter('paliwo',this.value)"></th>`,
  poj:        `<th data-col="poj"></th>`,
  mocKw:      `<th data-col="mocKw"></th>`,
  masaWl:     `<th data-col="masaWl"></th>`,
  msc:        `<th data-col="msc"></th>`,
  euro:       `<th data-col="euro"><input class="col-fi" type="text" placeholder="⌕" oninput="applyColFilter('euro',this.value)"></th>`,
  dmcF2:      `<th data-col="dmcF2"><input class="col-fi" type="text" placeholder="⌕ kg" oninput="applyColFilter('dmcF2',this.value)"></th>`,
  ladownosc:  `<th data-col="ladownosc"><input class="col-fi" type="text" placeholder="⌕ kg" oninput="applyColFilter('ladownosc',this.value)"></th>`,
  dataRej:    `<th data-col="dataRej"><input class="col-fi" type="text" placeholder="⌕ DD.MM.RRRR" oninput="applyColFilter('dataRej',this.value)"></th>`,
  katDR:      `<th data-col="katDR"><input class="col-fi" type="text" placeholder="⌕ N1/N3…" oninput="applyColFilter('katDR',this.value)"></th>`,
};

// ── Renderery komórek danych ─────────────────────────────────────────
// ctx = { t, isNew, needsDmcZ, isTrailerV }
const _FLEET_COL_TD = {
  rok:        (v,c)=>`<td data-col="rok">${v.rok||'—'}${c.isNew?'<span class="pill pill-new" style="margin-left:6px;font-size:9px">§2</span>':''}</td>`,
  typ:        (v)  =>`<td data-col="typ"><span class="pill pill-gray">${esc(v.typ)}</span></td>`,
  dmc:        (v)  =>`<td data-col="dmc" style="font-family:var(--mono);font-size:12px">${(v.dmc||v.dmcMax||0).toLocaleString('pl-PL')}</td>`,
  osie:       (v)  =>`<td data-col="osie" onclick="event.stopPropagation()"><select class="isel" onchange="setV(${v.id},'osie',parseInt(this.value))">${[1,2,3,4,5].map(n=>`<option ${v.osie===n?'selected':''}>${n}</option>`).join('')}</select></td>`,
  zawieszenie:(v)  =>`<td data-col="zawieszenie" onclick="event.stopPropagation()"><select class="isel" style="width:120px" onchange="setV(${v.id},'zawieszenie',this.value)"><option ${v.zawieszenie==='pneumatyczne'?'selected':''}>pneumatyczne</option><option ${v.zawieszenie==='równoważne'?'selected':''}>równoważne</option><option ${v.zawieszenie==='inne'?'selected':''}>inne</option></select></td>`,
  dmczesp:    (v,c)=>`<td data-col="dmczesp" onclick="event.stopPropagation()">${c.isTrailerV?`<input class="inum" style="width:70px" type="number" step="0.001" min="0" max="100" value="${((v.dmcZespolu||0)/1000).toFixed(1)}" onchange="setV(${v.id},'dmcZespolu',parseFloat(this.value)*1000||0)" title="DMC zesp. w tonach">${c.needsDmcZ?'<span style="color:var(--amber);font-size:11px"> ⚠</span>':''}` : '<span style="color:var(--text3)">—</span>'}</td>`,
  mies:       (v)  =>`<td data-col="mies" onclick="event.stopPropagation()" title="Miesiące obowiązku podatkowego (1–12). Dla nabycia: 13 minus miesiąc. Dla zbycia: numer miesiąca."><div style="display:flex;align-items:center;gap:3px"><input class="inum" type="number" min="1" max="12" value="${v.miesiacePodatku||12}" onchange="setV(${v.id},'miesiacePodatku',parseInt(this.value)||12)" style="width:36px;text-align:center"><button style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--text3);padding:0 2px" title="Oblicz z daty" onclick="event.stopPropagation();_pickMiesiace(${v.id})">📅</button></div></td>`,
  status:     (v)  =>`<td data-col="status"><span class="pill ${STAT_LABELS[v.status]||'pill-gray'}">${esc(v.status)}</span></td>`,
  oc:         (v)  =>`<td data-col="oc">${_datePill(v.ocEnd)}</td>`,
  ac:         (v)  =>`<td data-col="ac">${_datePill(v.acEnd)}</td>`,
  przeglad:   (v)  =>`<td data-col="przeglad">${_datePill(v.nextInspection)}</td>`,
  ocInsurer:  (v)  =>`<td data-col="ocInsurer" style="font-size:11px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(v.ocInsurer||'')}${v.ocPolicyNo?' · '+esc(v.ocPolicyNo):''}">${v.ocInsurer?`<div style="font-weight:500">${esc(v.ocInsurer)}</div>`:'<span style="color:var(--text3)">—</span>'}${v.ocPolicyNo?`<div style="color:var(--text3);font-size:10px;font-family:var(--mono)">${esc(v.ocPolicyNo)}</div>`:''}</td>`,
  acInsurer:  (v)  =>`<td data-col="acInsurer" style="font-size:11px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(v.acInsurer||'')}${v.acPolicyNo?' · '+esc(v.acPolicyNo):''}">${v.acInsurer?`<div style="font-weight:500">${esc(v.acInsurer)}</div>`:'<span style="color:var(--text3)">—</span>'}${v.acPolicyNo?`<div style="color:var(--text3);font-size:10px;font-family:var(--mono)">${esc(v.acPolicyNo)}</div>`:''}</td>`,
  udt:        (v)  =>`<td data-col="udt" style="font-size:11px">${v.hasUdt?(v.udtNextDate?_datePill(v.udtNextDate):'<span style="color:var(--amber);font-size:10px">brak daty</span>'):'<span style="color:var(--text3)">—</span>'}${v.hasUdt&&v.udtDeviceType?`<div style="font-size:10px;color:var(--text3)">${esc(v.udtDeviceType)}</div>`:''}</td>`,
  tacho:      (v)  =>`<td data-col="tacho" style="font-size:11px">${v.hasTacho?(v.tachoNextCalib?_datePill(v.tachoNextCalib):'<span style="color:var(--amber);font-size:10px">brak daty</span>'):'<span style="color:var(--text3)">—</span>'}</td>`,
  kierowca:   (v)  =>`<td data-col="kierowca" style="font-size:12px;white-space:nowrap">${v.kierowca?esc(v.kierowca):'<span style="color:var(--text3)">—</span>'}</td>`,
  km:         (v)  =>`<td data-col="km" style="font-size:12px;text-align:right;font-family:var(--mono);white-space:nowrap">${v.stanKilometrow!=null?v.stanKilometrow.toLocaleString('pl-PL'):'<span style="color:var(--text3)">—</span>'}${_gpsIndicator(v)}</td>`,
  dt1ok:      (v)  =>`<td data-col="dt1ok" style="text-align:center">${_dt1CompletenessCell(v)}</td>`,
  gmina:      (v)  =>`<td data-col="gmina" onclick="event.stopPropagation()" style="font-size:11px"><select class="isel" style="width:100px;font-size:11px" onchange="setV(${v.id},'gmina',this.value);renderFormularze&&renderFormularze()">${(window.GminyRates?GminyRates.listGminy():['Warszawa']).map(g=>`<option ${(v.gmina||'Warszawa')===g?'selected':''}>${g}</option>`).join('')}</select></td>`,
  kategoria:  (v,c)=>`<td data-col="kategoria">${c.t.cat?`<span class="pill ${CAT_COLORS[c.t.cat]||'pill-gray'}">${c.t.cat}</span>${c.needsDmcZ?'<span style="font-size:10px;color:var(--amber)"> brak DMC zesp.</span>':''}` : '<span style="color:var(--text3);font-size:11px">—</span>'}</td>`,
  podatek:    (v,c)=>`<td data-col="podatek" style="text-align:right">${c.t.amount>0?`<strong style="color:var(--green);font-family:var(--mono)">${fmt2(c.t.amount)} zł</strong>`:'<span style="color:var(--text3)">—</span>'}</td>`,
  vin:        (v)  =>`<td data-col="vin" style="font-size:10px;font-family:var(--mono);color:var(--text2)">${esc(v.vin||'—')}</td>`,
  paliwo:     (v)  =>`<td data-col="paliwo" style="font-size:11px">${esc(v.paliwo||'—')}</td>`,
  poj:        (v)  =>`<td data-col="poj" style="font-size:11px;text-align:right;font-family:var(--mono)">${v.pojSilnika!=null?v.pojSilnika.toLocaleString('pl-PL')+' cm³':'—'}</td>`,
  mocKw:      (v)  =>`<td data-col="mocKw" style="font-size:11px;text-align:right;font-family:var(--mono)">${v.mocKW!=null?v.mocKW+' kW':'—'}</td>`,
  masaWl:     (v)  =>`<td data-col="masaWl" style="font-size:11px;text-align:right;font-family:var(--mono)">${(v.masaWlasna??v.masaWlKg)!=null?(v.masaWlasna??v.masaWlKg).toLocaleString('pl-PL')+' kg':'—'}</td>`,
  msc:        (v)  =>`<td data-col="msc" style="font-size:11px;text-align:center">${v.miejscaSied!=null?v.miejscaSied:'—'}</td>`,
  euro:       (v)  =>`<td data-col="euro" style="font-size:11px">${esc(v.euro||'—')}</td>`,
  dmcF2:      (v)  =>`<td data-col="dmcF2" style="font-size:11px;text-align:right;font-family:var(--mono)">${v.dmcKg2!=null&&v.dmcKg2!==''?Number(v.dmcKg2).toLocaleString('pl-PL')+' kg':'—'}</td>`,
  ladownosc:  (v)  =>{const _d=v.dmcKg2||v.dmc||v.dmcMax,_m=v.masaWlasna??v.masaWlKg;const l=v.ladownosc!=null&&v.ladownosc!==''?Number(v.ladownosc):(_d&&_m!=null&&Number(_d)>Number(_m)?Number(_d)-Number(_m):null);return `<td data-col="ladownosc" style="font-size:11px;text-align:right;font-family:var(--mono)">${l!=null?l.toLocaleString('pl-PL')+' kg':'—'}</td>`;},
  dataRej:    (v)  =>`<td data-col="dataRej" style="font-size:11px;white-space:nowrap">${v.dataRejestracji||v.dataRej||'—'}</td>`,
  katDR:      (v)  =>`<td data-col="katDR" style="font-size:11px;text-align:center">${(v.katPojazdu||v.kategoria)?`<span class="pill pill-gray">${esc(v.katPojazdu||v.kategoria)}</span>`:'—'}</td>`,
};

const _COL_LABELS = {
  rok:'Rok',typ:'Typ',dmc:'DMC',osie:'Osie',zawieszenie:'Zawieszenie',
  dmczesp:'DMC zesp.',mies:'Mies.',status:'Status',
  oc:'OC (data)',ac:'AC (data)',przeglad:'Przegląd',
  kategoria:'Kategoria',podatek:'Podatek',
  ocInsurer:'Ubezpieczyciel OC',acInsurer:'Ubezpieczyciel AC',
  udt:'Badanie UDT',tacho:'Legalizacja tacho',
  kierowca:'Kierowca',km:'Stan km',dt1ok:'Kompletność DT-1',gmina:'Gmina DT-1',
  vin:'VIN',paliwo:'Paliwo (P.3)',poj:'Pojemność (cm³)',mocKw:'Moc (kW)',
  masaWl:'Masa własna (kg)',msc:'Miejsca siedz.',euro:'Norma EURO',
  dmcF2:'F.2 DMC z ładunkiem (kg)',ladownosc:'Ładowność (kg)',dataRej:'Data 1. rejestracji',katDR:'Kat. pojazdu DR (J)',
};

// ── Inicjalizacja ────────────────────────────────────────────────────
function _initColVis() {
  try { _colVis = JSON.parse(localStorage.getItem('taxColVis')) || null; } catch(e) {}
  if (!_colVis) _colVis = {..._COL_DEFAULTS};
  _initColOrder();
  try { _colFilters = JSON.parse(localStorage.getItem(_COL_FILTERS_LS)) || {}; } catch {}
  if (Object.values(_colFilters).some(v => v)) _filterRowVisible = true;
}

function _initColOrder() {
  try { _colOrder = JSON.parse(localStorage.getItem(_COL_ORDER_LS)) || null; } catch(e) {}
  if (!Array.isArray(_colOrder) || _colOrder.length !== _COL_ORDER_DEFAULT.length) {
    _colOrder = [..._COL_ORDER_DEFAULT];
  }
}

function _getColOrder() {
  if (!_colOrder) _initColOrder();
  return _colOrder;
}

// ── Dynamiczny thead ─────────────────────────────────────────────────
function _renderFleetThead() {
  const thead = document.getElementById('veh-thead');
  if (!thead) return;
  const order = _getColOrder();
  const S = 'position:sticky;z-index:2;background:var(--bg3)';
  thead.innerHTML = `<tr>
    <th class="col-sticky-th" style="width:36px;left:0"><input type="checkbox" id="chk-all" onchange="toggleAll(this)"></th>
    <th class="sort-th col-sticky-th" style="min-width:100px;left:36px" onclick="sortBy('nrRej')" data-i18n="col.plate">Nr rej.</th>
    <th class="sort-th col-sticky-th" style="left:136px" onclick="sortBy('marka')" data-i18n="col.brand">Marka / Model</th>
    ${order.map(id => _FLEET_COL_TH[id]||'').join('')}
    <th style="text-align:center" title="Karta pojazdu">📎</th>
  </tr>
  <tr id="veh-filter-row" style="${_filterRowVisible?'':'display:none'}">
    <th class="col-sticky-th" style="left:0"></th>
    <th class="col-sticky-th" style="left:36px"><input class="col-fi" type="text" placeholder="⌕ Nr rej." oninput="applyColFilter('nrRej',this.value)"></th>
    <th class="col-sticky-th" style="left:136px"><input class="col-fi" type="text" placeholder="⌕ Marka/model" oninput="applyColFilter('marka',this.value)"></th>
    ${order.map(id => _FLEET_COL_FI[id]||`<th data-col="${id}"></th>`).join('')}
    <th></th>
  </tr>`;
  // Przywróć wartości aktywnych filtrów w inputach
  for (const [col, val] of Object.entries(_colFilters)) {
    if (!val) continue;
    thead.querySelectorAll(`.col-fi[oninput*="'${col}'"]`).forEach(el => { el.value = val; });
  }
  // i18n dla dynamicznych nagłówków
  if (window.t) thead.querySelectorAll('[data-i18n]').forEach(el => {
    const v = window.t(el.getAttribute('data-i18n'));
    if (v !== el.getAttribute('data-i18n')) el.textContent = v;
  });
}

function _applyColVis() {
  if (!_colVis) return;
  for (const [col, vis] of Object.entries(_colVis)) {
    document.querySelectorAll(`[data-col="${col}"]`).forEach(el => {
      el.style.display = vis ? '' : 'none';
    });
  }
}

function toggleCol(col) {
  if (!_colVis) _initColVis();
  _colVis[col] = _colVis[col] ? 0 : 1;
  localStorage.setItem('taxColVis', JSON.stringify(_colVis));
  renderVeh();
  _renderColPanel();
}

function resetColVis() {
  _colVis = {..._COL_DEFAULTS};
  _colOrder = [..._COL_ORDER_DEFAULT];
  localStorage.setItem('taxColVis', JSON.stringify(_colVis));
  try { localStorage.setItem(_COL_ORDER_LS, JSON.stringify(_colOrder)); } catch {}
  renderVeh();
  _renderColPanel();
}

// ── Panel widoczności i kolejności ───────────────────────────────────
function _renderColPanel() {
  const panel = document.getElementById('col-vis-panel');
  if (!panel) return;
  if (!_colVis) _initColVis();
  const order = _getColOrder();
  const presets = _getColPresets();

  const listHtml = order.map(id => `
    <div data-flcol="${id}" draggable="true" style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:grab">
      <i class="ti ti-grip-vertical" style="color:var(--text3);font-size:14px;flex-shrink:0;pointer-events:none"></i>
      <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:12px;white-space:nowrap;flex:1">
        <input type="checkbox" ${_colVis[id]?'checked':''} onchange="toggleCol('${id}')">
        ${_COL_LABELS[id]||id}
      </label>
    </div>`).join('');

  const presetsHtml = presets.length ? `
    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin:10px 0 4px;letter-spacing:.5px">Moje presety</div>
    ${presets.map((p,i) => `
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
        <button class="btn btn-gray" style="flex:1;font-size:11px;padding:3px 8px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" onclick="applyColPreset(${i})" title="Zastosuj: ${esc(p.name)}">${esc(p.name)}</button>
        <button class="btn btn-red" style="font-size:10px;padding:2px 6px;flex-shrink:0" onclick="deleteColPreset(${i})" title="Usuń preset"><i class="ti ti-x"></i></button>
      </div>`).join('')}` : '';

  panel.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px;letter-spacing:.5px">Kolumny — przeciągnij = zmień kolejność</div>
    <div id="col-order-list" style="max-height:320px;overflow-y:auto;margin-bottom:4px">${listHtml}</div>
    ${presetsHtml}
    <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px;display:flex;flex-direction:column;gap:5px">
      <div style="display:flex;gap:4px">
        <input id="col-preset-name" type="text" placeholder="Nazwa presetu…" style="flex:1;font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text)">
        <button class="btn btn-blue" style="font-size:11px;padding:4px 8px;white-space:nowrap" onclick="saveColPreset()"><i class="ti ti-device-floppy"></i>Zapisz</button>
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-gray" style="font-size:11px;padding:3px 8px;flex:1" onclick="switchFleetView('fleet')"><i class="ti ti-layout-list"></i>Flota</button>
        <button class="btn btn-gray" style="font-size:11px;padding:3px 8px;flex:1" onclick="switchFleetView('dt1')"><i class="ti ti-file-invoice"></i>DT-1</button>
      </div>
      <button class="btn btn-gray" style="font-size:11px;padding:3px 10px;width:100%" onclick="resetColVis()"><i class="ti ti-refresh"></i>Resetuj domyślne</button>
    </div>`;

  _initColOrderDnd(panel.querySelector('#col-order-list'));
}

function _initColOrderDnd(list) {
  if (!list) return;
  let dragging = null;
  list.addEventListener('dragstart', e => {
    dragging = e.target.closest('[data-flcol]');
    if (dragging) dragging.style.opacity = '0.4';
  });
  list.addEventListener('dragend', () => {
    if (dragging) { dragging.style.opacity = ''; dragging = null; }
    _colOrder = [...list.querySelectorAll('[data-flcol]')].map(el => el.dataset.flcol);
    try { localStorage.setItem(_COL_ORDER_LS, JSON.stringify(_colOrder)); } catch {}
    renderVeh();
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const over = e.target.closest('[data-flcol]');
    if (over && dragging && over !== dragging) {
      const rect = over.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) over.before(dragging);
      else over.after(dragging);
    }
  });
}

function toggleColPanel() {
  const panel = document.getElementById('col-vis-panel');
  if (!panel) return;
  if (!_colVis) _initColVis();
  const isOpen = panel.style.display === 'block';
  if (isOpen) { _closeColPanel(); return; }
  _renderColPanel();
  panel.style.display = 'block';
  setTimeout(() => {
    document.addEventListener('click', _colPanelOutsideClick);
    document.addEventListener('keydown', _colPanelEscape);
  }, 0);
}

function _closeColPanel() {
  const panel = document.getElementById('col-vis-panel');
  if (panel) panel.style.display = 'none';
  document.removeEventListener('click', _colPanelOutsideClick);
  document.removeEventListener('keydown', _colPanelEscape);
}

function _colPanelOutsideClick(e) {
  const panel = document.getElementById('col-vis-panel');
  const btn   = document.getElementById('col-vis-btn');
  // composedPath() captures path at dispatch time — handles detached nodes from innerHTML replacements
  const path  = e.composedPath ? e.composedPath() : [];
  if (path.includes(panel) || path.includes(btn)) return;
  _closeColPanel();
}

function _colPanelEscape(e) {
  if (e.key === 'Escape') _closeColPanel();
}

// ── Presety ──────────────────────────────────────────────────────────
function _getColPresets() {
  try { return JSON.parse(localStorage.getItem(_COL_PRESETS_LS)) || []; } catch { return []; }
}

function saveColPreset() {
  const nameEl = document.getElementById('col-preset-name');
  const name = nameEl?.value.trim();
  if (!name) { toast('⚠ Wpisz nazwę presetu'); return; }
  if (!_colVis) _initColVis();
  const presets = _getColPresets();
  presets.push({ name, vis: {..._colVis}, order: [..._getColOrder()] });
  try { localStorage.setItem(_COL_PRESETS_LS, JSON.stringify(presets)); } catch {}
  if (nameEl) nameEl.value = '';
  toast(`✓ Preset „${name}" zapisany`);
  _renderColPanel();
}

function applyColPreset(i) {
  const p = _getColPresets()[i];
  if (!p) return;
  _colVis = {..._COL_DEFAULTS, ...p.vis};
  _colOrder = Array.isArray(p.order) && p.order.length === _COL_ORDER_DEFAULT.length ? [...p.order] : [..._COL_ORDER_DEFAULT];
  try {
    localStorage.setItem('taxColVis', JSON.stringify(_colVis));
    localStorage.setItem(_COL_ORDER_LS, JSON.stringify(_colOrder));
  } catch {}
  renderVeh();
  _renderColPanel();
  toast(`✓ Zastosowano preset „${p.name}"`);
}

function deleteColPreset(i) {
  const presets = _getColPresets();
  const name = presets[i]?.name || '';
  presets.splice(i, 1);
  try { localStorage.setItem(_COL_PRESETS_LS, JSON.stringify(presets)); } catch {}
  _renderColPanel();
}

// ==================== FLEET VIEW MODES ====================
function switchFleetView(mode) {
  _viewMode = mode;
  localStorage.setItem('fleetViewMode', mode);
  if (!_colVis) _initColVis();
  if (mode === 'fleet') Object.assign(_colVis, _COL_FLEET);
  else if (mode === 'dt1') Object.assign(_colVis, _COL_DT1);
  localStorage.setItem('taxColVis', JSON.stringify(_colVis));
  renderVeh();
}

function _syncViewModeButtons() {
  document.querySelectorAll('.view-mode-btn').forEach(b => {
    b.className = b.className.replace('btn-blue','btn-gray');
    if (!b.className.includes('btn-gray')) b.className += ' btn-gray';
  });
  const active = document.getElementById('view-btn-' + _viewMode);
  if (active) { active.className = active.className.replace('btn-gray','btn-blue'); }
}

async function _renderFleetKpiStrip() {
  const el = document.getElementById('fleet-kpi-strip');
  if (!el) return;

  // Szybki render z danych lokalnych (natychmiastowy)
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const noDriver = (vehs || []).filter(v => !v.kierowca).length;
  el.innerHTML = `<div class="fkpi-card"><div class="fkpi-val" style="font-size:13px;color:var(--text3)">…</div><div class="fkpi-lab">ładowanie KPI</div></div>`;

  // Pobranie KPI z serwera (1 zapytanie zamiast iteracji po wszystkich pojazdach)
  try {
    const API  = window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
    const tok  = localStorage.getItem('cf_token');
    const comp = window.currentCompanyId || 'mtoilet';
    const r    = await fetch(`${API}/api/dashboard/stats?company=${comp}`, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const s = await r.json();
    window._dashStats = s;
    _renderKpiFromStats(s, noDriver);
  } catch (e) {
    // Fallback do obliczeń lokalnych
    const alertOC  = (vehs || []).filter(v => { if (!v.ocEnd) return false; const d = Math.round((new Date(v.ocEnd)-now)/86400000); return d <= 30; }).length;
    const insp30   = (vehs || []).filter(v => { if (!v.nextInspection) return false; const d = Math.round((new Date(v.nextInspection)-now)/86400000); return d >= 0 && d <= 30; }).length;
    _renderKpiCards({ oc: alertOC, insp: insp30, noDriver, total: (vehs||[]).length, fines: 0 });
  }
}

function _renderKpiFromStats(s, noDriver) {
  const ocAlert  = s.oc_expired + s.oc_7 + s.oc_30;
  const inspAlert = s.przeglad_expired + s.przeglad_30;
  _renderKpiCards({ oc: ocAlert, oc_expired: s.oc_expired, oc_7: s.oc_7,
    insp: inspAlert, insp_expired: s.przeglad_expired,
    fines: s.fines_unpaid, fines_urgent: s.fines_deadline_7,
    noDriver, total: s.vehicles_total, drivers_exp: s.drivers_license_expiring });
}

function _kpiGoto(filter) {
  const alertMap = { oc: 'oc_30', przeglad: 'insp_30' };
  if (alertMap[filter]) { quickFilterVeh(alertMap[filter]); }
  else { showPage('alert-dashboard'); if (filter) setTimeout(() => window.TaxOrderAlertDashboard?._setFilter(filter), 300); }
}

function _renderKpiCards({ oc=0, oc_expired=0, oc_7=0, insp=0, insp_expired=0, fines=0, fines_urgent=0, noDriver=0, total=0, drivers_exp=0 } = {}) {
  const el = document.getElementById('fleet-kpi-strip');
  if (!el) return;
  const now = Date.now();
  const gpsRecent = (vehs||[]).filter(v => {
    const h = Array.isArray(v.gpsHistory) ? v.gpsHistory : [];
    const last = h.filter(x=>x.lat&&x.lon).sort((a,b)=>new Date(b.ts)-new Date(a.ts))[0];
    return last && (now - new Date(last.ts).getTime()) < 24*3600000;
  }).length;
  el.innerHTML = `
    <div class="fkpi-card" onclick="showPage('pojazdy')" style="cursor:pointer" title="Przejdź do listy pojazdów">
      <div class="fkpi-val">${total}</div>
      <div class="fkpi-lab">pojazdy w bazie</div>
    </div>
    ${gpsRecent > 0 ? `
    <div class="fkpi-card" onclick="showPage('mapa')" style="cursor:pointer" title="Pojazdy z aktywnym sygnałem GPS (< 24h) — kliknij aby otworzyć mapę">
      <div class="fkpi-val" style="color:var(--green)">${gpsRecent}</div>
      <div class="fkpi-lab"><i class="ti ti-map-pin" style="font-size:10px"></i> GPS aktywny (24h)</div>
    </div>` : ''}
    <div class="fkpi-card ${oc_expired > 0 ? 'fkpi-red' : oc_7 > 0 ? 'fkpi-red' : oc > 0 ? 'fkpi-amber' : ''}" onclick="_kpiGoto('oc')" style="cursor:pointer" title="Pokaż alerty OC">
      <div class="fkpi-val">${oc}</div>
      <div class="fkpi-lab">OC — wygasłe lub ≤ 30 dni${oc_expired > 0 ? ` <span style="font-size:10px">(${oc_expired} wygasłe)</span>` : ''}</div>
    </div>
    <div class="fkpi-card ${insp_expired > 0 ? 'fkpi-red' : insp > 0 ? 'fkpi-amber' : ''}" onclick="_kpiGoto('przeglad')" style="cursor:pointer" title="Pokaż alerty przeglądów">
      <div class="fkpi-val">${insp}</div>
      <div class="fkpi-lab">przeglądy — wygasłe lub ≤ 30 dni</div>
    </div>
    ${fines > 0 ? `
    <div class="fkpi-card ${fines_urgent > 0 ? 'fkpi-red' : 'fkpi-amber'}" onclick="FinesModule.open()" style="cursor:pointer" title="Przejdź do mandatów">
      <div class="fkpi-val">${fines}</div>
      <div class="fkpi-lab">mandaty nieopłacone${fines_urgent > 0 ? ` <span style="font-size:10px">(${fines_urgent} pilne)</span>` : ''}</div>
    </div>` : ''}
    <div class="fkpi-card ${noDriver > 0 ? 'fkpi-amber' : ''}" title="Pojazdy bez przypisanego kierowcy">
      <div class="fkpi-val">${noDriver}</div>
      <div class="fkpi-lab">bez przypisanego kierowcy</div>
    </div>
    ${drivers_exp > 0 ? `
    <div class="fkpi-card fkpi-amber" onclick="showPage('kierowcy')" style="cursor:pointer" title="Kierowcy z wygasającym prawem jazdy">
      <div class="fkpi-val">${drivers_exp}</div>
      <div class="fkpi-lab">prawa jazdy ≤ 30 dni</div>
    </div>` : ''}`;
}

function _renderCards(list) {
  const el = document.getElementById('fleet-cards');
  if (!el) return;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  el.innerHTML = list.map(v => {
    const t = calcTax(v);
    const statusCls = STAT_LABELS[v.status] || 'pill-gray';
    const minDays = Math.min(
      v.ocEnd         ? Math.round((new Date(v.ocEnd)         - now) / 86400000) : 999,
      v.acEnd         ? Math.round((new Date(v.acEnd)         - now) / 86400000) : 999,
      v.nextInspection? Math.round((new Date(v.nextInspection)- now) / 86400000) : 999
    );
    const alertCls = minDays < 0 ? 'fc-alert-red' : minDays < 30 ? 'fc-alert-amber' : '';
    return `<div class="fleet-card ${alertCls}" onclick="TaxOrderVehicleDetail.open(${v.id})">
      <div class="fc-head">
        <span class="fc-plate">${esc(v.nrRej)}</span>
        <span class="pill ${statusCls}" style="font-size:10px">${esc(v.status||'—')}</span>
      </div>
      <div class="fc-brand">${esc(v.marka)} ${esc(v.model)}</div>
      <div class="fc-meta">${v.rok||'—'} · ${esc(v.typ||'—')}${v.euro?' · '+esc(v.euro):''}</div>
      <div class="fc-row"><span class="fc-icon">👤</span><span style="${!v.kierowca?'color:var(--text3);font-style:italic':''}">${esc(v.kierowca||'brak kierowcy')}</span></div>
      ${v.stanKilometrow != null ? `<div class="fc-row"><span class="fc-icon">🛣</span><span style="font-family:var(--mono)">${v.stanKilometrow.toLocaleString('pl-PL')} km</span>${_gpsIndicator(v)}</div>` : ''}
      <div class="fc-dates">
        <span>OC ${_datePill(v.ocEnd)}</span>
        <span>AC ${_datePill(v.acEnd)}</span>
        <span>Przegląd ${_datePill(v.nextInspection)}</span>
      </div>
      ${v.hasUdt ? `<div class="fc-dates"><span>UDT ${_datePill(v.udtNextDate)}</span>${v.hasTacho?`<span>Tacho ${_datePill(v.tachoNextCalib)}</span>`:''}</div>` : ''}
      ${t.cat ? `<div style="margin-top:4px"><span class="pill ${CAT_COLORS[t.cat]||'pill-gray'}" style="font-size:10px">DT-1: ${t.cat} · ${fmt2(t.amount)} zł</span></div>` : ''}
    </div>`;
  }).join('') || `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text3)">Brak pojazdów</div>`;
}

// ==================== COUNTERS ====================
function updateCounters() {
  const cnt = selected.size;
  const total = totalTax();
  document.getElementById('badge-sel').textContent = cnt;
  document.getElementById('btn-sel-cnt').textContent = cnt;
  document.getElementById('s-sel').textContent = cnt;
  document.getElementById('s-tax').textContent = fmtZl(total).toLocaleString('pl-PL')+' zł';
  document.getElementById('s-new').textContent = vehs.filter(v=>selected.has(v.id)&&(parseInt(v.rok)||0)>=2024).length;
  document.getElementById('pd-cnt').textContent = getSelTax().filter(v=>v.cat).length;
  const pdTax = getSelTax().filter(v=>v.cat).reduce((s,v)=>s+(v.amount||0),0);
  const pdEl = document.getElementById('pd-taxable'); if(pdEl) pdEl.textContent = getSelTax().filter(v=>v.cat).length;
  const pdTotalEl = document.getElementById('pd-total'); if(pdTotalEl) pdTotalEl.textContent = fmt2(pdTax)+' zł';
  const lbl = document.getElementById('veh-count-label');
  if (lbl) {
    const filtered = filterVeh().length;
    lbl.textContent = filtered === vehs.length
      ? `${vehs.length} pojazdów`
      : `${filtered} z ${vehs.length} pojazdów`;
  }
  // Bulk-bar
  const bulkBar = document.getElementById('bulk-bar');
  if (bulkBar) {
    if (cnt > 0) {
      bulkBar.style.display = 'flex';
      const s = cnt === 1 ? 'pojazd zaznaczony' : cnt < 5 ? 'pojazdy zaznaczone' : 'pojazdów zaznaczonych';
      const bc = document.getElementById('bulk-count');
      if (bc) bc.textContent = cnt + ' ' + s;
    } else {
      bulkBar.style.display = 'none';
    }
  }
}

function refreshAll() { renderVeh(); renderKalkulator(); updateCounters(); renderDash(); window.TaxOrderNotifications?.updateBadge?.(); }
function updateAll() { updateCounters(); renderKalkulator(); }

// ==================== BULK ACTIONS ====================
function bulkExportSelected() {
  const sel = getSel();
  if (!sel.length) return;
  if (!window.XLSX) { toast('⚠ Brak biblioteki XLSX'); return; }
  const rows = sel.map(v => ({
    'Nr rej.': v.nrRej || '',
    'Marka': v.marka || '',
    'Model': v.model || '',
    'Rok': v.rok || '',
    'DMC (kg)': v.dmc ?? v.dmcMax ?? '',
    'Typ': v.typ || '',
    'Właściciel': v.wlasciciel || '',
    'Status': v.status || '',
    'Kierowca': v.kierowca || '',
    'Kat. DT-1': v.cat || '',
    'Podatek': v.amount > 0 ? v.amount : '',
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Pojazdy');
  XLSX.writeFile(wb, 'flota-' + new Date().toISOString().slice(0,10) + '.xlsx');
  toast('✓ Wyeksportowano ' + sel.length + ' pojazdów do Excel');
}

function bulkAssignCompany() {
  const sel = getSel();
  if (!sel.length) return;
  const companies = ['mToilet', 'GCON', 'KJR Supply', 'G-Rental', 'NWK Invest', 'Wolund'];
  const choice = prompt('Przypisz firmę dla ' + sel.length + ' pojazdów:\n' + companies.map((c,i)=>(i+1)+'. '+c).join('\n') + '\n\nWpisz numer:');
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= companies.length) return;
  const company = companies[idx];
  sel.forEach(v => { v.wlasciciel = company; window.TaxOrderFleetCloud?.saveVehicle?.(v); });
  renderVeh(); updateCounters();
  toast('✓ Przypisano „' + company + '" dla ' + sel.length + ' pojazdów');
}

function bulkSetTaxMonths() {
  const sel = getSel();
  if (!sel.length) return;
  const months = prompt('Ustaw miesiące podatku DT-1 dla ' + sel.length + ' pojazdów (1–12):');
  const m = parseInt(months);
  if (isNaN(m) || m < 1 || m > 12) { toast('⚠ Nieprawidłowa liczba miesięcy (1–12)'); return; }
  sel.forEach(v => { v.miesiacePodatku = m; window.TaxOrderFleetCloud?.saveVehicle?.(v); });
  renderVeh(); updateCounters(); renderKalkulator();
  toast('✓ Ustawiono ' + m + ' miesięcy podatku dla ' + sel.length + ' pojazdów');
}

function bulkChangeStatus() {
  const sel = getSel();
  if (!sel.length) return;
  const statuses = ['Własny', 'Leasing', 'Wynajęty'];
  const choice = prompt('Zmień status dla ' + sel.length + ' pojazdów:\n1. Własny\n2. Leasing\n3. Wynajęty\n\nWpisz numer:');
  const idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= statuses.length) return;
  const status = statuses[idx];
  sel.forEach(v => { v.status = status; window.TaxOrderFleetCloud?.saveVehicle?.(v); });
  renderVeh(); updateCounters();
  toast('✓ Zmieniono status na „' + status + '" dla ' + sel.length + ' pojazdów');
}

function bulkCompare() {
  const ids = getSel();
  if (ids.size < 2) { toast('Zaznacz co najmniej 2 pojazdy do porównania'); return; }
  const vList = [...ids].slice(0, 4).map(id => (window.vehs || []).find(v => v.id === id)).filter(Boolean);
  if (vList.length < 2) return;

  const yr = String(new Date().getFullYear());
  const _days = ds => { if (!ds) return null; const d = new Date(ds + 'T00:00:00'); return isNaN(d) ? null : Math.round((d - Date.now()) / 86400000); };
  const _fuelEff = v => {
    const h = [...(v.fuelHistory || [])].filter(x => x.km > 0 && x.liters > 0).sort((a, b) => a.km - b.km);
    let l = 0, k = 0, n = 0;
    for (let i = 1; i < h.length; i++) { const d = h[i].km - h[i - 1].km; if (d > 10 && d < 5000) { l += h[i].liters; k += d; n++; } }
    return n >= 2 && k > 0 ? (l / k * 100).toFixed(1) : null;
  };

  const ROWS = [
    ['Marka / Model',          v => (v.marka || '—') + ' ' + (v.model || '')],
    ['Rok',                    v => v.rok || '—'],
    ['Typ pojazdu',            v => v.typ || '—'],
    ['DMC (kg)',               v => v.dmc ?? v.dmcMax ?? '—'],
    ['Paliwo',                 v => v.paliwo || '—'],
    ['Kierowca',               v => v.kierowca || '—'],
    ['Stan licznika (km)',     v => v.stanKilometrow != null ? v.stanKilometrow.toLocaleString('pl-PL') : '—'],
    ['Norma spalania (l/100)', v => v.normaSpalania || '—'],
    ['Śr. spalanie (rzeczyw.)',v => { const e = _fuelEff(v); return e ? e + ' l/100km' : '—'; }],
    ['OC — wygasa',            v => v.ocEnd || '—', v => v.ocEnd && _days(v.ocEnd) < 30],
    ['AC — wygasa',            v => v.acEnd || '—', v => v.acEnd && _days(v.acEnd) < 30],
    ['Przegląd — termin',      v => v.nextInspection || '—', v => v.nextInspection && _days(v.nextInspection) < 30],
    ['Kategoria DT-1',         v => (typeof calcTax === 'function' ? calcTax(v).cat : null) || v.cat || '—'],
    ['Podatek DT-1 (zł/rok)',  v => { const t = typeof calcTax === 'function' ? calcTax(v) : {}; return t.amount != null ? Math.round(t.amount).toLocaleString('pl-PL') + ' zł' : '—'; }],
    ['TCO — paliwo (rok)',     v => { const f = (v.fuelHistory || []).filter(h => (h.date || '').startsWith(yr)).reduce((s, h) => s + (h.totalGross || 0), 0); return f > 0 ? f.toFixed(0) + ' zł' : '—'; }],
    ['TCO — serwis (rok)',     v => { const s = (v.serviceHistory || []).filter(h => (h.date || '').startsWith(yr)).reduce((s, h) => s + (+h.cost || 0), 0); return s > 0 ? s.toFixed(0) + ' zł' : '—'; }],
    ['Ubezpieczenia (rok)',    v => { const i = (+(v.ocPremium) || 0) + (+(v.acPremium) || 0); return i > 0 ? i.toFixed(0) + ' zł' : '—'; }],
    ['Status',                 v => v.status || '—'],
  ];

  const headCols = vList.map(v =>
    `<th style="padding:8px 12px;text-align:center;background:var(--blue-light,#eff6ff);color:var(--blue);white-space:nowrap">
      ${esc(v.nrRej)}<br><span style="font-size:10px;font-weight:400;color:var(--text2)">${esc(v.marka)} ${esc(v.model)}</span>
    </th>`
  ).join('');

  const bodyRows = ROWS.map(([lbl, fn, alertFn]) => {
    const vals = vList.map(fn);
    const alerts = alertFn ? vList.map(alertFn) : vList.map(() => false);
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:7px 12px;font-size:12px;font-weight:500;background:var(--bg3);white-space:nowrap">${lbl}</td>
      ${vals.map((val, i) => `<td style="padding:7px 12px;font-size:12px;text-align:center;color:${alerts[i] ? 'var(--amber,#f59e0b)' : 'var(--text)'}">${esc(String(val))}</td>`).join('')}
    </tr>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'compare-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:5500;display:flex;align-items:flex-start;justify-content:center;padding:20px 10px;overflow:auto';
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--radius-lg);width:min(${200 + vList.length * 180}px,100%);box-shadow:0 8px 40px rgba(0,0,0,.3);overflow:hidden;margin-top:10px">
      <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:1">
        <i class="ti ti-scale" style="font-size:20px;color:var(--blue)"></i>
        <strong style="font-size:15px">Porównanie pojazdów (${vList.length})</strong>
        <button onclick="document.getElementById('compare-modal').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:22px;color:var(--text2);line-height:1">×</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:${120 + vList.length * 150}px">
          <thead><tr>
            <th style="padding:8px 12px;text-align:left;background:var(--bg3);font-size:12px;white-space:nowrap;min-width:160px">Parametr</th>
            ${headCols}
          </tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── REGON / NIP lookup (White List API MF) ────────────────────────────────
async function lookupNip() {
  const nipEl  = document.getElementById('tp-nip');
  const btnEl  = document.getElementById('btn-nip-lookup');
  const infoEl = document.getElementById('nip-lookup-info');
  const nip = (nipEl?.value || '').replace(/\s/g, '');
  if (!/^\d{10}$/.test(nip)) { if (infoEl) infoEl.textContent = 'NIP musi mieć 10 cyfr.'; return; }

  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="ti ti-loader-2"></i>Szukam…'; }
  if (infoEl) infoEl.textContent = '';

  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await fetch(`https://wl-api.mf.gov.pl/api/check/nip/${nip}?date=${today}`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const s = data?.result?.subject;
    if (!s) throw new Error('Brak danych dla tego NIP');

    const setV = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };

    setV('tp-nip',    s.nip || nip);
    setV('tp-regon',  s.regon || '');
    if (s.name) setV('tp-nazwa', s.name.toUpperCase());

    // Parsuj adres: "ul. Toruńska 31, 03-226 Warszawa"
    const addr = s.residenceAddress || s.workingAddress || '';
    if (addr) {
      const mKod = addr.match(/(\d{2}-\d{3})\s+(.+)/);
      if (mKod) {
        setV('tp-kod',   mKod[1]);
        setV('tp-miasto', (mKod[2]||'').toUpperCase().split(',')[0].trim());
      }
      const mUl = addr.match(/^(?:ul\.|al\.|os\.|pl\.)?\s*([^,\d]+?)\s+(\d+[a-zA-Z\/\d]*)/i);
      if (mUl) {
        setV('tp-ulica', mUl[1].toUpperCase().replace(/^ul\./i,'').trim());
        setV('tp-dom',   mUl[2].trim());
      }
    }

    if (infoEl) infoEl.innerHTML = `<span style="color:var(--green)">✓ Znaleziono: ${esc(s.name || '—')} · Status VAT: ${esc(s.statusVat || '—')}</span>`;
    updateAll();
  } catch (e) {
    if (infoEl) infoEl.innerHTML = `<span style="color:var(--red)">Błąd: ${esc(e.message)}. Sprawdź NIP lub wypełnij dane ręcznie.</span>`;
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<i class="ti ti-search"></i>Szukaj'; }
  }
}

// ==================== FUEL DASH ====================
function renderFuelDash() {
  const el = document.getElementById('dash-fuel');
  if (!el) return;
  const now = new Date();
  const thisMonth = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');

  const stats = vehs
    .filter(v => Array.isArray(v.fuelHistory) && v.fuelHistory.length)
    .map(v => {
      const mh = v.fuelHistory.filter(h => (h.date||'').startsWith(thisMonth));
      return {
        v,
        liters: mh.reduce((s,h)=>s+(h.liters||0),0),
        cost:   mh.reduce((s,h)=>s+(h.totalGross||0),0),
        count:  mh.length,
      };
    })
    .filter(s => s.count > 0)
    .sort((a,b) => b.cost - a.cost);

  if (!stats.length) {
    el.innerHTML = `<div style="color:var(--text3);font-size:12px;grid-column:1/-1;padding:16px 0">
      Brak danych o tankowaniach w tym miesiącu. Zaimportuj CSV z karty paliwowej lub dodaj ręcznie w karcie pojazdu.
    </div>`;
    return;
  }

  // Sumy
  const totalCost   = stats.reduce((s,x)=>s+x.cost,0);
  const totalLiters = stats.reduce((s,x)=>s+x.liters,0);
  const totalCO2    = window.FuelImport?.getFleetCO2 ? window.FuelImport.getFleetCO2(thisMonth) : 0;
  const co2Label    = totalCO2 >= 1000 ? `${(totalCO2/1000).toFixed(2)} t` : `${totalCO2.toFixed(0)} kg`;
  const prevMonth   = (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))(new Date(now.getFullYear(), now.getMonth()-1, 1));
  const prevCO2     = window.FuelImport?.getFleetCO2 ? window.FuelImport.getFleetCO2(prevMonth) : 0;
  const co2Trend    = prevCO2 > 0 ? ((totalCO2 - prevCO2) / prevCO2 * 100) : null;
  const co2TrendStr = co2Trend != null ? `<span style="font-size:10px;color:${co2Trend<=0?'var(--green)':'var(--red)'}">${co2Trend>0?'↑':'↓'}${Math.abs(co2Trend).toFixed(0)}% vs poprzedni mies.</span>` : '';

  el.innerHTML = `
    <div style="padding:14px;background:var(--amber-light,#fff8e6);border-radius:var(--radius);border:1px solid var(--amber,#f59e0b)">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em">Łączny koszt paliwa</div>
      <div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--amber)">${totalCost.toFixed(2)} zł</div>
      <div style="font-size:11px;color:var(--text2)">${totalLiters.toFixed(1)} l · ${stats.length} pojazdów</div>
    </div>
    ${totalCO2 > 0 ? `
    <div style="padding:14px;background:rgba(34,197,94,.07);border-radius:var(--radius);border:1px solid var(--green)">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em">Emisja CO₂ floty (KOBIZE)</div>
      <div style="font-size:22px;font-weight:700;font-family:var(--mono);color:var(--green)">${co2Label}</div>
      <div style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:6px">${co2TrendStr}
        <button onclick="FuelImport.exportKobize(${now.getFullYear()-1})" style="margin-left:auto;font-size:10px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Eksport ${now.getFullYear()-1}</button>
      </div>
    </div>` : ''}
    ${stats.slice(0,5).map(s => {
      const sCO2 = s.v.fuelHistory?.filter(h=>(h.date||'').startsWith(thisMonth))
        .reduce((acc,h)=> acc + (h.co2kg!=null ? h.co2kg : (h.liters||0)*(window.FuelImport?.KOBIZE_FACTORS?.[h.product]||0)), 0) || 0;
      return `
      <div style="padding:12px;background:var(--bg3);border-radius:var(--radius);cursor:pointer" onclick="TaxOrderVehicleDetail.open(${s.v.id})">
        <div style="font-size:11px;font-weight:700;font-family:var(--mono);margin-bottom:4px">${esc(s.v.nrRej)}</div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${esc(s.v.marka)} ${esc(s.v.model)}</div>
        <div style="display:flex;justify-content:space-between;font-size:12px">
          <span style="font-family:var(--mono);font-weight:600">${s.cost.toFixed(2)} zł</span>
          <span style="color:var(--text3)">${s.liters.toFixed(1)} l</span>
          ${sCO2>0?`<span style="color:var(--green);font-size:10px">${sCO2.toFixed(0)} kg CO₂</span>`:''}
        </div>
      </div>`}).join('')}`;
}

function exportPaliwoCSV() {
  const mSel = document.getElementById('paliwo-month-sel');
  const vSel = document.getElementById('paliwo-veh-sel');
  const fSel = document.getElementById('paliwo-fuel-sel');
  const selMonth = mSel?.value || (d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'))(new Date());
  const selVeh   = vSel?.value || '';
  const selFuel  = fSel?.value || '';

  const rows = [];
  vehs.forEach(v => {
    if (!Array.isArray(v.fuelHistory)) return;
    if (selVeh && String(v.id) !== selVeh) return;
    v.fuelHistory.forEach(h => {
      if (!(h.date || '').startsWith(selMonth)) return;
      if (selFuel && h.product !== selFuel) return;
      rows.push({ v, h });
    });
  });
  rows.sort((a, b) => (b.h.date || '').localeCompare(a.h.date || ''));

  if (!rows.length) { toast?.('Brak danych do eksportu'); return; }

  const hdrs = ['Data', 'Nr rej.', 'Marka', 'Model', 'Rodzaj paliwa', 'Ilość (l)', 'Cena/l (zł)', 'Kwota brutto (zł)', 'Stacja', 'Nr karty', 'CO2 (kg)', 'Stan licznika (km)'];
  const data = rows.map(({ v, h }) => [
    h.date || '',
    v.nrRej || '',
    v.marka || '',
    v.model || '',
    h.product || '',
    h.liters != null ? String(h.liters) : '',
    h.pricePerLiter != null ? String(h.pricePerLiter) : '',
    h.totalGross != null ? String(h.totalGross) : '',
    h.station || '',
    h.cardNumber || '',
    h.co2kg != null ? String(h.co2kg) : '',
    h.km != null ? String(h.km) : '',
  ]);

  const csv = '﻿' + [hdrs, ...data].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tankowania_' + selMonth + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast?.('✓ Wyeksportowano ' + rows.length + ' tankowań do CSV');
}

// ==================== PALIWO PAGE ====================
function renderPaliwoPage() {
  const now = new Date();

  // --- Wypełnienie selecta miesięcy (18 ostatnich) ---
  const mSel = document.getElementById('paliwo-month-sel');
  if (mSel && !mSel.dataset.init) {
    mSel.dataset.init = '1';
    const opts = [];
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
      const label = d.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
      opts.push(`<option value="${val}"${i === 0 ? ' selected' : ''}>${label}</option>`);
    }
    mSel.innerHTML = opts.join('');
  }

  // --- Wypełnienie selecta pojazdów (odświeżane przy każdym wejściu) ---
  const vSel = document.getElementById('paliwo-veh-sel');
  if (vSel) {
    const prev = vSel.value;
    const withFuel = vehs.filter(v => v.fuelHistory?.length);
    vSel.innerHTML = '<option value="">Wszystkie pojazdy</option>' +
      withFuel.map(v => `<option value="${v.id}">${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`).join('');
    if (prev) vSel.value = prev;
  }

  const selMonth = mSel?.value || now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const selVeh   = vSel?.value || '';
  const selFuel  = document.getElementById('paliwo-fuel-sel')?.value || '';

  // --- Zbieranie danych tankowań ---
  let rows = [];
  vehs.forEach(v => {
    if (!Array.isArray(v.fuelHistory)) return;
    if (selVeh && String(v.id) !== selVeh) return;
    v.fuelHistory.forEach(h => {
      if (!(h.date || '').startsWith(selMonth)) return;
      if (selFuel && h.product !== selFuel) return;
      rows.push({ v, h });
    });
  });
  rows.sort((a, b) => (b.h.date || '').localeCompare(a.h.date || ''));

  const totalLiters = rows.reduce((s, r) => s + (r.h.liters || 0), 0);
  const totalCost   = rows.reduce((s, r) => s + (r.h.totalGross || 0), 0);
  const avgPrice    = totalLiters > 0 ? totalCost / totalLiters : 0;
  const totalCO2    = rows.reduce((s, r) => s + (r.h.co2kg || 0), 0);

  // --- KPI karty ---
  const kpiEl = document.getElementById('paliwo-kpi');
  if (kpiEl) {
    kpiEl.innerHTML = [
      { label: 'Łączny koszt paliwa', val: totalCost.toFixed(2) + ' zł', color: 'var(--amber)', icon: 'ti-currency-dollar' },
      { label: 'Ilość zatankowana', val: totalLiters.toFixed(1) + ' l', color: 'var(--blue)', icon: 'ti-droplet' },
      { label: 'Śr. cena za litr', val: avgPrice > 0 ? avgPrice.toFixed(3) + ' zł/l' : '—', color: 'var(--text2)', icon: 'ti-tag' },
      { label: 'Tankowania', val: rows.length, color: 'var(--text2)', icon: 'ti-list' },
      { label: 'Emisja CO₂ (KOBIZE)', val: totalCO2 > 0 ? (totalCO2 >= 1000 ? (totalCO2/1000).toFixed(2)+' t' : totalCO2.toFixed(0)+' kg') : '—', color: 'var(--green)', icon: 'ti-leaf' },
    ].map(k => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">
          <i class="ti ${k.icon}"></i> ${k.label}
        </div>
        <div style="font-size:22px;font-weight:700;font-family:var(--mono);color:${k.color}">${k.val}</div>
      </div>`).join('');
  }

  // --- Tabela tankowań ---
  const fmt = (n) => n != null ? n.toFixed(2) : '—';
  const tbody = document.getElementById('paliwo-tbody');
  if (tbody) {
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:2rem">Brak danych tankowań w wybranym okresie</td></tr>`;
    } else {
      tbody.innerHTML = rows.slice(0, 200).map(({ v, h }) => `<tr>
        <td style="font-family:var(--mono);font-size:12px">${h.date || '—'}</td>
        <td style="font-weight:600;font-family:var(--mono)">${esc(v.nrRej)}</td>
        <td style="font-size:12px;color:var(--text2)">${esc(v.marka)} ${esc(v.model)}</td>
        <td><span class="pill pill-gray" style="font-size:11px">${esc(h.product || '—')}</span></td>
        <td style="text-align:right;font-family:var(--mono)">${(h.liters||0).toFixed(1)}</td>
        <td style="text-align:right;font-family:var(--mono)">${h.pricePerLiter ? h.pricePerLiter.toFixed(3) : '—'}</td>
        <td style="text-align:right;font-family:var(--mono);font-weight:600">${fmt(h.totalGross)}</td>
        <td style="font-size:12px;color:var(--text2)">${esc(h.station || '—')}</td>
        <td style="font-size:12px;color:var(--text2)">${esc(h.cardNumber || '—')}</td>
      </tr>`).join('');
    }
  }

  // --- Top 10 pojazdów wg kosztu ---
  const top10El = document.getElementById('paliwo-top10');
  if (top10El) {
    const byVeh = {};
    rows.forEach(({ v, h }) => {
      if (!byVeh[v.id]) byVeh[v.id] = { v, cost: 0, liters: 0, fuelRows: [], count: 0 };
      byVeh[v.id].cost   += h.totalGross || 0;
      byVeh[v.id].liters += h.liters || 0;
      byVeh[v.id].fuelRows.push(h);
      byVeh[v.id].count++;
    });
    const sorted = Object.values(byVeh).sort((a, b) => b.cost - a.cost).slice(0, 10);
    if (!sorted.length) {
      top10El.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:1rem">Brak danych</td></tr>`;
    } else {
      top10El.innerHTML = sorted.map((x, i) => {
        // l/100km z kolejnych tankowań z km w wybranym okresie
        const withKm = x.fuelRows.filter(h => h.km != null && h.km > 0 && h.liters > 0).sort((a, b) => a.km - b.km);
        let _effL = 0, _effKm = 0, _effN = 0;
        for (let j = 1; j < withKm.length; j++) {
          const kd = withKm[j].km - withKm[j-1].km;
          if (kd > 10 && kd < 5000) { _effL += withKm[j].liters; _effKm += kd; _effN++; }
        }
        const avg = (_effN >= 1 && _effKm > 0) ? (_effL / _effKm * 100).toFixed(1) + ' l/100km' : '—';
        return `<tr>
          <td style="color:var(--text3);font-size:13px">${i + 1}</td>
          <td style="font-weight:600;font-family:var(--mono)">${esc(x.v.nrRej)}</td>
          <td style="font-size:12px;color:var(--text2)">${esc(x.v.marka)} ${esc(x.v.model)}</td>
          <td style="text-align:right;font-family:var(--mono)">${x.liters.toFixed(1)}</td>
          <td style="text-align:right;font-family:var(--mono);font-weight:600">${x.cost.toFixed(2)} zł</td>
          <td style="text-align:right;color:var(--text3)">${avg}</td>
        </tr>`;
      }).join('');
    }
  }

  // --- Anomalie spalania (pojazdy > 15% ponad normę) ---
  const anomalyEl = document.getElementById('paliwo-anomaly');
  if (anomalyEl) {
    const anomalies = [];
    vehs.forEach(v => {
      const norm = v.normaSpalania ? parseFloat(v.normaSpalania) : null;
      if (!norm || !Array.isArray(v.fuelHistory) || !v.fuelHistory.length) return;
      const withKm = [...v.fuelHistory].filter(h => h.km != null && h.km > 0 && h.liters > 0).sort((a, b) => a.km - b.km);
      let _effL = 0, _effKm = 0, _effN = 0;
      for (let i = 1; i < withKm.length; i++) {
        const kd = withKm[i].km - withKm[i-1].km;
        if (kd > 10 && kd < 5000) { _effL += withKm[i].liters; _effKm += kd; _effN++; }
      }
      if (_effN < 2 || _effKm <= 0) return;
      const avgEff = _effL / _effKm * 100;
      if (avgEff > norm * 1.15) {
        const pct = ((avgEff / norm - 1) * 100).toFixed(0);
        anomalies.push({ v, norm, avgEff: avgEff.toFixed(1), pct: +pct, intervals: _effN });
      }
    });
    anomalies.sort((a, b) => b.pct - a.pct);

    if (!anomalies.length) {
      anomalyEl.innerHTML = '';
    } else {
      anomalyEl.innerHTML = `
        <div style="font-size:15px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <i class="ti ti-alert-triangle" style="color:var(--red)"></i>Anomalie spalania — przekroczenie normy o >15%
          <span style="font-size:12px;font-weight:400;color:var(--text3);margin-left:4px">${anomalies.length} pojazd${anomalies.length===1?'':'ów'} (wszystkie okresy)</span>
        </div>
        <div class="tbl-wrap"><table>
          <thead><tr>
            <th>Nr rej.</th><th>Pojazd</th>
            <th style="text-align:right">Norma (l/100km)</th>
            <th style="text-align:right">Faktyczne (l/100km)</th>
            <th style="text-align:right">Przekroczenie</th>
            <th style="text-align:right">Odcinki km</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${anomalies.map(a => `<tr>
              <td style="font-weight:600;font-family:var(--mono)">${esc(a.v.nrRej)}</td>
              <td style="font-size:12px;color:var(--text2)">${esc(a.v.marka)} ${esc(a.v.model)}</td>
              <td style="text-align:right;font-family:var(--mono)">${a.norm.toFixed(1)}</td>
              <td style="text-align:right;font-family:var(--mono);font-weight:700;color:var(--red)">${a.avgEff}</td>
              <td style="text-align:right">
                <span style="font-size:12px;font-weight:700;background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:99px">+${a.pct}%</span>
              </td>
              <td style="text-align:right;color:var(--text3);font-size:12px">${a.intervals}</td>
              <td>
                <button class="tbtn" onclick="showPage('pojazdy');setTimeout(()=>{TaxOrderVehicleDetail.open(${a.v.id});setTimeout(()=>TaxOrderVehicleDetail?._tab('koszty'),400)},200)" title="Otwórz kartę pojazdu">
                  <i class="ti ti-external-link"></i>
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>`;
    }
  }

  // --- Mini wykres miesięczny (12 miesięcy wstecz) ---
  const chartEl = document.getElementById('paliwo-chart-monthly');
  if (chartEl) {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    }
    const mCosts = months.map(m => {
      let c = 0;
      vehs.forEach(v => {
        if (!Array.isArray(v.fuelHistory)) return;
        if (selVeh && String(v.id) !== selVeh) return;
        v.fuelHistory.forEach(h => {
          if ((h.date || '').startsWith(m)) c += h.totalGross || 0;
        });
      });
      return c;
    });
    const maxCost = Math.max(...mCosts, 1);
    chartEl.innerHTML = `<div style="display:flex;align-items:flex-end;gap:4px;height:80px">` +
      mCosts.map((c, i) => {
        const pct = Math.round(c / maxCost * 100);
        const label = months[i].slice(5);
        const isSelected = months[i] === selMonth;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer" onclick="document.getElementById('paliwo-month-sel').value='${months[i]}';renderPaliwoPage()">
          <div style="width:100%;height:${pct}%;min-height:2px;background:${isSelected?'var(--blue)':'var(--border)'};border-radius:2px 2px 0 0;transition:background .15s" title="${c.toFixed(0)} zł"></div>
          <div style="font-size:9px;color:${isSelected?'var(--blue)':'var(--text3)'};font-weight:${isSelected?'700':'400'}">${label}</div>
        </div>`;
      }).join('') + `</div>`;
  }

  // --- Rozkład wg rodzaju paliwa ---
  const fuelTypeEl = document.getElementById('paliwo-chart-fuel-type');
  if (fuelTypeEl) {
    const byType = {};
    rows.forEach(({ h }) => {
      const p = h.product || 'Inne';
      if (!byType[p]) byType[p] = { liters: 0, cost: 0 };
      byType[p].liters += h.liters || 0;
      byType[p].cost   += h.totalGross || 0;
    });
    const types = Object.entries(byType).sort((a, b) => b[1].cost - a[1].cost);
    const COLORS = ['var(--blue)','var(--amber)','var(--green)','var(--red)','var(--text2)'];
    if (!types.length) {
      fuelTypeEl.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:16px 0">Brak danych</div>`;
    } else {
      fuelTypeEl.innerHTML = types.map(([type, d], i) => {
        const pct = totalCost > 0 ? (d.cost / totalCost * 100) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span style="font-weight:600">${type}</span>
            <span style="color:var(--text2);font-family:var(--mono)">${d.cost.toFixed(0)} zł (${pct.toFixed(0)}%)</span>
          </div>
          <div style="height:6px;background:var(--bg3);border-radius:3px">
            <div style="height:100%;width:${pct}%;background:${COLORS[i%COLORS.length]};border-radius:3px"></div>
          </div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${d.liters.toFixed(1)} l</div>
        </div>`;
      }).join('');
    }
  }
}

// ==================== MODULARNY KOKPIT ====================
const DASH_WIDGETS = [
  { id: 'kpi',          label: 'Wskaźniki KPI floty',          icon: 'ti-chart-bar' },
  { id: 'notifs',       label: 'Mandaty / Kierowcy / Karty',   icon: 'ti-bell' },
  { id: 'alerts',       label: 'Alerty terminów',              icon: 'ti-bell-ringing' },
  { id: 'service_fuel', label: 'Serwis + Paliwo',              icon: 'ti-tools' },
  { id: 'activity',     label: 'Aktywność floty',              icon: 'ti-activity' },
  { id: 'structure',    label: 'Struktura floty + DT-1',       icon: 'ti-chart-pie' },
];

const _DASH_LS_KEY = 'taxorder-dash-config';

function _getDashConfig() {
  try {
    const raw = localStorage.getItem(_DASH_LS_KEY);
    if (!raw) return _dashDefaultConfig();
    const cfg = JSON.parse(raw);
    // Dodaj nowe widgety (których brakuje w zapisanej konfiguracji) na koniec listy
    const known = new Set(cfg.order || []);
    DASH_WIDGETS.forEach(w => { if (!known.has(w.id)) cfg.order.push(w.id); });
    cfg.hidden = cfg.hidden || [];
    return cfg;
  } catch { return _dashDefaultConfig(); }
}

function _dashDefaultConfig() {
  return { order: DASH_WIDGETS.map(w => w.id), hidden: [] };
}

function _applyDashConfig() {
  const cfg = _getDashConfig();
  const layout = document.getElementById('dash-layout');
  if (!layout) return;
  cfg.order.forEach((id, idx) => {
    const el = layout.querySelector(`[data-wid="${id}"]`);
    if (!el) return;
    el.style.order = idx;
    el.style.display = cfg.hidden.includes(id) ? 'none' : '';
  });
}

function openDashCustomize() {
  const cfg = _getDashConfig();
  const oldList = document.getElementById('dash-customize-list');
  if (!oldList) return;
  // Klonuj węzeł bez dzieci — usuwa poprzednie listenery drag
  const list = oldList.cloneNode(false);
  oldList.parentNode.replaceChild(list, oldList);
  list.innerHTML = cfg.order.map(id => {
    const w = DASH_WIDGETS.find(x => x.id === id);
    if (!w) return '';
    const hidden = cfg.hidden.includes(id);
    return `<li class="dash-widget-row" data-wid="${id}" draggable="true"
      style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--border);cursor:grab;user-select:none">
      <i class="ti ti-grip-vertical" style="color:var(--text3);font-size:17px;flex-shrink:0;pointer-events:none"></i>
      <input type="checkbox" id="dw-chk-${id}" ${hidden ? '' : 'checked'} style="width:15px;height:15px;cursor:pointer;flex-shrink:0">
      <label for="dw-chk-${id}" style="flex:1;cursor:pointer;display:flex;align-items:center;gap:7px;font-size:13px;pointer-events:none">
        <i class="ti ${w.icon}" style="color:var(--text2);font-size:15px"></i>${w.label}
      </label>
    </li>`;
  }).join('');
  _initDashDnd(list);
  document.getElementById('modal-dash-customize').style.display = 'flex';
}

function closeDashCustomize() {
  document.getElementById('modal-dash-customize').style.display = 'none';
}

function openEpuapModal() {
  document.getElementById('epuap-step1-done').style.display = 'none';
  document.getElementById('warsaw-bookmarklet-result').style.display = 'none';
  document.getElementById('warsaw-data-panel').style.display = 'none';
  document.getElementById('modal-epuap').style.display = 'flex';
}
function closeEpuapModal() {
  document.getElementById('modal-epuap').style.display = 'none';
}

// ─── PROFIL ZAUFANY — Frontend ─────────────────────────────────────────────────
function loginWithPZ() {
  const btn  = document.getElementById('pz-login-btn');
  const info = document.getElementById('pz-login-info');
  if (btn)  { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader"></i> Przekierowanie do login.gov.pl…'; }
  if (info) { info.style.display = 'block'; info.textContent = 'Trwa przekierowanie do Profilu Zaufanego…'; }
  const API     = window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
  const company = window.currentCompanyId || 'mtoilet';
  const appUrl  = window.location.origin + window.location.pathname;
  window.location.href = `${API}/api/auth/pz/start?company=${encodeURIComponent(company)}&app_url=${encodeURIComponent(appUrl)}`;
}

async function _handlePzHashCallback() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash.includes('pz_token=') && !hash.includes('pz_error=')) return false;

  const params   = new URLSearchParams(hash);
  const pzError  = params.get('pz_error');
  const pzEmail  = params.get('pz_email');
  const pzToken  = params.get('pz_token');
  const company  = params.get('company');

  history.replaceState(null, '', window.location.pathname + window.location.search);

  if (pzError) {
    const msgs = {
      no_account:    `Brak konta TaxOrder dla: ${esc(pzEmail || '?')}. Skontaktuj się z administratorem.`,
      invalid_state: 'Sesja wygasła. Spróbuj zalogować się ponownie.',
    };
    showLoginErr(msgs[pzError] || `Błąd PZ: ${esc(pzError)}`);
    return true;
  }
  if (!pzToken) return false;

  localStorage.setItem('cf_token', pzToken);
  if (company) window.currentCompanyId = company;

  try {
    const API  = window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
    const hdrs = { Authorization: 'Bearer ' + pzToken };
    const resp = await fetch(`${API}/api/auth/me`, { headers: hdrs });
    if (!resp.ok) throw new Error('Brak sesji (HTTP ' + resp.status + ')');
    const u = await resp.json();

    // Pobierz claims PZ do pre-fillowania DT-1
    const pzR = await fetch(`${API}/api/auth/pz/userinfo`, { headers: hdrs }).catch(() => null);
    if (pzR?.ok) {
      const pzD = await pzR.json().catch(() => null);
      if (pzD?.pz) window._pzClaims = pzD.pz;
    }

    currentUser = { id: u.id, email: u.email, name: u.name || u.email, role: u.role || 'kierowca', active: true, _loginViaPZ: true };
    window.currentUserId = u.id || null;

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    const initials = (currentUser.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
    document.getElementById('user-name').textContent   = currentUser.name;
    document.getElementById('user-role-lbl').textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
    applyRoleAccess(currentUser.role);
    sessionStorage.setItem('dt1_user_email', currentUser.email);

    // Badge PZ w topbar
    const uname = document.getElementById('user-name');
    if (uname) {
      const badge = document.createElement('span');
      badge.title    = 'Zalogowano Profilem Zaufanym';
      badge.style.cssText = 'font-size:9px;background:#003566;color:#fff;border-radius:3px;padding:1px 5px;margin-left:6px;vertical-align:middle;flex-shrink:0';
      badge.textContent = 'PZ';
      uname.after(badge);
    }

    if (typeof loadCompanyState === 'function') { loadCompanyState(window.currentCompanyId); updateCompanyUI(); }
    if (window.TaxOrderFleetCloud?.loadVehicles) {
      await window.TaxOrderFleetCloud.loadVehicles().catch(e => console.warn('[PZ] loadVehicles:', e.message));
      window.TaxOrderFleetCloud?.subscribeRealTime?.(window.currentCompanyId);
    }
    if (typeof refreshAll === 'function') refreshAll();
    renderDash();
    renderVeh();
    updateCounters();
  } catch (e) {
    localStorage.removeItem('cf_token');
    showLoginErr('Błąd logowania PZ: ' + e.message);
  }
  return true;
}

async function applyPzClaimsToForm() {
  let claims = window._pzClaims;
  if (!claims) {
    const tok = localStorage.getItem('cf_token');
    if (!tok) { alert('Zaloguj się Profilem Zaufanym, aby skorzystać z tej funkcji.'); return; }
    const API = window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev';
    const r = await fetch(`${API}/api/auth/pz/userinfo`, { headers: { Authorization: 'Bearer ' + tok } }).catch(() => null);
    if (!r?.ok) { alert('Brak danych Profilu Zaufanego. Zaloguj się Profilem Zaufanym.'); return; }
    const d = await r.json().catch(() => null);
    claims = d?.pz;
    window._pzClaims = claims;
  }
  if (!claims) { alert('Brak danych Profilu Zaufanego w sesji.'); return; }
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  if (claims.nip)   { set('tp-nip', claims.nip.replace(/\D/g, '')); set('dt1-nip', claims.nip.replace(/\D/g, '')); }
  const full = [claims.given_name, claims.family_name].filter(Boolean).join(' ');
  if (full) { set('tp-nazwa', full); set('tp-name', full); }
  if (claims.email) { set('tp-email', claims.email); }
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg2);border:1px solid var(--green);color:var(--green);border-radius:var(--radius);padding:10px 16px;font-size:13px;z-index:9999;box-shadow:0 2px 12px rgba(0,0,0,.2)';
  t.innerHTML = '<i class="ti ti-circle-check"></i> Dane z Profilu Zaufanego zostały wczytane';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ─── WARSZAWA — bookmarklet + kopia danych ─────────────────────────────────────
function _collectDt1DataForWarsaw() {
  const g  = id => (document.getElementById(id)?.value || '').trim();
  const g2 = (a, b) => g(a) || g(b);
  const rok = parseInt(g('dt1-rok') || g('rok-dt1') || String(new Date().getFullYear()), 10);
  return {
    nip:     g('tp-nip').replace(/\D/g, ''),
    nazwa:   g2('tp-nazwa', 'tp-name'),
    ulica:   g2('tp-ulica', 'tp-street'),
    nr:      g2('tp-dom',   'tp-house-no'),
    lokal:   g('tp-lokal') || '',
    kod:     g2('tp-kod',   'tp-postcode'),
    miasto:  g2('tp-miasto','tp-city'),
    rok,
    cel:     g2('tp-cel',   'tp-celPodatnik') || '1',
    pojazdy: (window.vehs || []).filter(v => ((v.dmc ?? v.dmcMax ?? 0) >= 3500)).map(v => ({
      nr_rej:          (v.nr_rej || v.nrRej || '').toUpperCase(),
      vin:             v.vin || '',
      marka:           v.marka || '',
      model:           v.model || '',
      rok:             v.rok   || '',
      typ:             v.typ   || '',
      dmc:             v.dmc   ?? v.dmcMax ?? 0,
      osie:            v.osie  || v.axles_count || 2,
      zawieszenie:     v.zawieszenie || v.suspension_type || 'pneumatyczne',
      dataNabycia:     v.dataNabycia    || v.purchaseDate || '',
      dataRejestracji: v.dataRejestracji || '',
    })),
  };
}

function generateWarsawBookmarklet() {
  const D = _collectDt1DataForWarsaw();
  if (!D.nip && !D.nazwa) { alert('Uzupełnij dane podatnika w zakładce Podatnik.'); return; }

  // Silnik bookmarkletu (minifikowany inline) — wypełnia pola React przez nativeInputValueSetter
  const script = `(function(D){
var ns=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
function fill(el,v){if(!el||v==null||v==='')return;ns.call(el,String(v));['input','change'].forEach(function(e){el.dispatchEvent(new Event(e,{bubbles:true}));});}
function q(sel){return document.querySelector(sel);}
function byLbl(txt){var all=document.querySelectorAll('label');for(var i=0;i<all.length;i++){var t=all[i].textContent.trim();if(t===txt||t===txt+' *'){var f=all[i].getAttribute('for');return f?document.getElementById(f):null;}}return null;}
fill(q('input[name="nip"],input[id*="nip"i]')||byLbl('NIP'),D.nip);
fill(q('input[name="nazwaFirmy"],input[name="nazwa"],input[id*="nazwa"i]')||byLbl('Nazwa'),D.nazwa);
fill(q('input[name="ulica"],input[id*="ulica"i]')||byLbl('Ulica'),D.ulica);
fill(q('input[name="nrDomu"],input[id*="nrDomu"i]')||byLbl('Nr domu'),D.nr);
fill(q('input[name="nrLokalu"],input[id*="nrLokalu"i]')||byLbl('Nr lokalu'),D.lokal);
fill(q('input[name="kodPocztowy"],input[id*="kodPoczt"i]')||byLbl('Kod pocztowy'),D.kod);
fill(q('input[name="miejscowosc"],input[name="miasto"],input[id*="miasto"i]')||byLbl('Miejscowość'),D.miasto);
var sel=q('select[name="rokPodatkowy"],select[id*="rok"i]');
if(sel){sel.value=D.rok;sel.dispatchEvent(new Event('change',{bubbles:true}));}
var rows=D.pojazdy.map(function(p,i){return '<tr style="background:'+(i%2?'#f8f9fa':'#fff')+'"><td>'+p.nr_rej+'</td><td>'+p.marka+' '+p.model+'</td><td>'+Number(p.dmc/1000).toFixed(1).replace('.',',')+' t</td><td>'+p.osie+'</td><td>'+p.zawieszenie+'</td><td>'+(p.dataNabycia||'—')+'</td></tr>';}).join('');
var pan=document.createElement('div');
pan.style='position:fixed;top:16px;right:16px;z-index:999999;background:#fff;border:2px solid #003566;border-radius:8px;padding:14px;width:480px;max-height:80vh;overflow-y:auto;font-family:sans-serif;font-size:12px;box-shadow:0 4px 24px rgba(0,0,0,.35)';
pan.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="color:#003566;font-size:14px">TaxOrder Pro → Warszawa '+D.rok+'</b><button onclick="this.closest(\'div[style]\').remove()" style="border:none;background:none;cursor:pointer;font-size:20px;color:#666">×</button></div><p style="color:#555;margin:0 0 8px"><b>'+D.nip+'</b> '+D.nazwa+'<br><small>'+[D.ulica,D.nr].filter(Boolean).join(' ')+', '+D.kod+' '+D.miasto+'</small></p>'+(rows?'<p style="margin:8px 0 4px;font-weight:600;color:#003566">Pojazdy DT-1 (dodaj ręcznie w formularzu Warszawy):</p><table style="width:100%;border-collapse:collapse;font-size:11px"><thead style="background:#003566;color:#fff"><tr><th>Nr rej.</th><th>Marka</th><th>DMC</th><th>Osie</th><th>Zawieszenie</th><th>Nabycie</th></tr></thead><tbody>'+rows+'</tbody></table>':'<p style="color:#888">Brak pojazdów DT-1 (DMC ≥ 3,5 t)</p>')+'<p style="margin:10px 0 0;color:#888;font-size:10px">Wygenerowano przez TaxOrder Pro. Pola podatnika zostały uzupełnione automatycznie.</p>';
document.body.appendChild(pan);
})`.replace(/\s{2,}/g,' ');

  const bm = 'javascript:' + script + '(' + JSON.stringify(D) + ')';
  const resultEl = document.getElementById('warsaw-bookmarklet-result');
  const linkEl   = document.getElementById('warsaw-bookmarklet-link');
  const labelEl  = document.getElementById('warsaw-bookmarklet-label');
  if (resultEl) resultEl.style.display = 'block';
  if (linkEl)   linkEl.href = bm;
  if (labelEl)  labelEl.textContent = `TaxOrder → Warszawa ${D.rok}`;
}

function copyWarsawData() {
  const D = _collectDt1DataForWarsaw();
  const lines = [
    `=== DT-1 ${D.rok} — dane dla moja.warszawa19115.pl ===`,
    '',
    'PODATNIK:',
    `NIP:         ${D.nip}`,
    `Nazwa:       ${D.nazwa}`,
    `Adres:       ${[D.ulica, D.nr, D.lokal].filter(Boolean).join(' ')}, ${D.kod} ${D.miasto}`,
    `Cel:         ${D.cel === '1' ? 'złożenie deklaracji' : 'korekta'}`,
    '',
    `POJAZDY DT-1 (${D.pojazdy.length}):`,
    ...D.pojazdy.map((p, i) =>
      `${i+1}. ${p.nr_rej} | ${p.marka} ${p.model} | rok: ${p.rok} | DMC: ${(p.dmc/1000).toFixed(1).replace('.',',')} t | ${p.osie} osie | ${p.zawieszenie} | nabycie: ${p.dataNabycia||'—'} | VIN: ${p.vin||'—'}`
    ),
  ];
  const text = lines.join('\n');
  const show = () => {
    const panel = document.getElementById('warsaw-data-panel');
    const pre   = document.getElementById('warsaw-data-text');
    if (panel) panel.style.display = 'block';
    if (pre)   pre.textContent = text;
  };
  navigator.clipboard.writeText(text).then(() => {
    show();
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg2);border:1px solid var(--green);color:var(--green);border-radius:var(--radius);padding:10px 16px;font-size:13px;z-index:9999;box-shadow:0 2px 12px rgba(0,0,0,.2)';
    t.innerHTML = '<i class="ti ti-clipboard-check"></i> Dane skopiowane do schowka';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }).catch(show);
}

function saveDashCustomize() {
  const list = document.getElementById('dash-customize-list');
  const items = [...list.querySelectorAll('[data-wid]')];
  const cfg = {
    order: items.map(el => el.dataset.wid),
    hidden: items.filter(el => !el.querySelector('input[type=checkbox]').checked).map(el => el.dataset.wid),
  };
  try { localStorage.setItem(_DASH_LS_KEY, JSON.stringify(cfg)); } catch (e) { console.warn('[Dash] Nie można zapisać konfiguracji:', e); }
  _applyDashConfig();
  closeDashCustomize();
  toast('✓ Układ kokpitu zapisany');
}

function resetDashCustomize() {
  localStorage.removeItem(_DASH_LS_KEY);
  _applyDashConfig();
  closeDashCustomize();
  toast('Przywrócono domyślny układ kokpitu');
}

function _initDashDnd(list) {
  let dragging = null;
  list.addEventListener('dragstart', e => {
    dragging = e.target.closest('[data-wid]');
    if (dragging) { dragging.style.opacity = '0.45'; dragging.style.cursor = 'grabbing'; }
  });
  list.addEventListener('dragend', () => {
    if (dragging) { dragging.style.opacity = ''; dragging.style.cursor = 'grab'; dragging = null; }
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const over = e.target.closest('[data-wid]');
    if (over && dragging && over !== dragging) {
      const rect = over.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) over.before(dragging);
      else over.after(dragging);
    }
  });
}

// ==================== DASH ====================
function renderDash() {
  _applyDashConfig();
  const brands = {};
  vehs.forEach(v=>{ if(!brands[v.marka])brands[v.marka]=0; brands[v.marka]++; });
  const el = document.getElementById('dash-brands');
  if(el) el.innerHTML = Object.entries(brands).sort((a,b)=>b[1]-a[1]).map(([m,n])=>{
    const cats = new Set(vehs.filter(v=>v.marka===m).map(v=>getCat(v)).filter(Boolean));
    return `<tr><td>${m}</td><td style="font-weight:600">${n}</td><td>${[...cats].map(c=>`<span class="pill ${CAT_COLORS[c]||'pill-gray'}" style="margin-right:3px">${c}</span>`).join('')||'—'}</td></tr>`;
  }).join('');
  const newCount = vehs.filter(v=>(parseInt(v.rok)||0)>=2024).length;
  document.getElementById('s-new').textContent = newCount + ' poj.';
  document.getElementById('s-total').textContent = vehs.length;

  // Alerty — pojazdy z terminami w ciągu 60 dni lub przeterminowanymi
  const alertsEl = document.getElementById('dash-alerts');
  if (alertsEl) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const DAYS60 = 60 * 86400000;
    const _alertDates = v => {
      const d = [
        {label:'OC', date:v.ocEnd},
        {label:'AC', date:v.acEnd},
        {label:'Przegląd', date:v.nextInspection},
      ];
      if (v.hasUdt && v.udtNextDate) d.push({label:'UDT', date:v.udtNextDate});
      if (v.hasTacho && v.tachoNextCalib) d.push({label:'Tacho', date:v.tachoNextCalib});
      if (v.tireNextChange) d.push({label:'Opony', date:v.tireNextChange});
      (v.serviceHistory||[]).forEach(s => { if (s.nextServiceDate) d.push({label:'Serwis', date:s.nextServiceDate}); });
      return d;
    };
    const alerts = vehs
      .filter(v => _alertDates(v).some(({date}) => date && (new Date(date) - now) < DAYS60))
      .map(v => {
        const dates = _alertDates(v).filter(x=>x.date).map(x=>new Date(x.date));
        const minDate = dates.reduce((a,b)=>a<b?a:b, new Date(9999,0));
        return {v, minDate};
      })
      .sort((a,b) => a.minDate - b.minDate);

    alertsEl.innerHTML = !alerts.length
      ? '<tr><td colspan="7" style="color:var(--text3);text-align:center;padding:12px">Brak alertów — wszystkie terminy aktualne</td></tr>'
      : alerts.map(({v}) => `<tr style="cursor:pointer" onclick="TaxOrderVehicleDetail.open(${v.id})" title="Otwórz kartę pojazdu">
      <td><strong style="font-family:var(--mono)">${esc(v.nrRej)}</strong></td>
      <td style="font-size:12px">${esc(v.marka)} ${esc(v.model)}</td>
      <td>${_datePill(v.ocEnd)}</td>
      <td>${_datePill(v.acEnd)}</td>
      <td>${_datePill(v.nextInspection)}</td>
      <td style="font-size:11px">
        ${v.hasUdt&&v.udtNextDate?_datePill(v.udtNextDate):'<span style="color:var(--text3)">—</span>'}
        ${v.hasTacho&&v.tachoNextCalib?'<span style="margin-left:4px">'+_datePill(v.tachoNextCalib)+'</span>':''}
      </td>
      <td style="text-align:center" onclick="event.stopPropagation()">
        <button class="btn btn-gray" style="font-size:11px;padding:3px 8px" onclick="TaxOrderVehicleDetail.open(${v.id})" title="Karta pojazdu">
          <i class="ti ti-id-badge"></i>
        </button>
      </td>
    </tr>`).join('');
  }
  renderFuelDash();
  _renderServiceDash();
  _renderFinesDash();
  _renderDriversDash();
  _renderFleetCardsDash();
  _renderFleetKpi();
  _renderAgeDist();
  _renderActivityFeed();
  const _luEl = document.getElementById('dash-last-update');
  if (_luEl) _luEl.textContent = 'Odświeżono ' + new Date().toLocaleTimeString('pl-PL', {hour:'2-digit', minute:'2-digit'});
}

function _renderActivityFeed() {
  const el = document.getElementById('dash-activity');
  if (!el) return;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const events = [];

  (window.vehs || []).forEach(v => {
    const nrRej = v.nrRej || v.nr_rej || '';
    const id = v.id;
    // Serwisy
    (v.serviceHistory || []).forEach(s => {
      if (!s.date) return;
      events.push({ date: s.date, icon: 'ti-tools', color: '#2563eb',
        text: `Serwis: ${(window.ServiceModule?.SERVICE_TYPES?.[s.type]?.label || s.type || 'Serwis')}${s.description ? ' — ' + s.description : ''}`,
        sub: s.cost ? `${Number(s.cost).toFixed(0)} zł` : '',
        nrRej, id });
    });
    // Szkody
    (v.damageHistory || []).forEach(d => {
      if (!d.date) return;
      events.push({ date: d.date, icon: 'ti-alert-triangle', color: '#dc2626',
        text: `Szkoda: ${d.type || d.description || 'niezdefiniowana'}`,
        sub: d.cost ? `${Number(d.cost).toFixed(0)} zł` : '',
        nrRej, id });
    });
    // Tankowania (ostatnie 1 na pojazd)
    const lastFuel = [...(v.fuelHistory || [])].sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1)[0];
    if (lastFuel?.date) {
      events.push({ date: lastFuel.date, icon: 'ti-gas-station', color: '#d97706',
        text: `Tankowanie: ${lastFuel.liters ? Number(lastFuel.liters).toFixed(1)+' l' : ''}`,
        sub: lastFuel.totalGross ? `${Number(lastFuel.totalGross).toFixed(0)} zł` : '',
        nrRej, id });
    }
  });

  events.sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1);
  const recent = events.slice(0, 12);

  if (!recent.length) {
    el.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:16px 0">Brak ostatnich zdarzeń.</div>`;
    return;
  }

  el.innerHTML = recent.map(e => {
    const d = new Date(e.date + (e.date.includes('T') ? '' : 'T00:00:00'));
    const diff = Math.round((now - d) / 86400000);
    const timeLabel = diff === 0 ? 'dzisiaj' : diff === 1 ? 'wczoraj' : `${diff} dni temu`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border);cursor:pointer" onclick="TaxOrderVehicleDetail.open(${e.id})">
      <i class="ti ${e.icon}" style="color:${e.color};font-size:14px;flex-shrink:0"></i>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:700;font-family:var(--mono)">${e.nrRej}</span>
          <span style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.text}</span>
        </div>
        ${e.sub ? `<div style="font-size:10px;color:var(--text3)">${e.sub}</div>` : ''}
      </div>
      <span style="font-size:10px;color:var(--text3);flex-shrink:0">${timeLabel}</span>
    </div>`;
  }).join('');
}

function _renderServiceDash() {
  const el = document.getElementById('dash-service');
  if (!el || !window.ServiceModule) return;
  const upcoming = window.ServiceModule.getUpcomingServices(30);
  const overdue  = upcoming.filter(x => x.days < 0);
  if (!upcoming.length) {
    el.innerHTML = `<div style="color:var(--text3);font-size:12px;padding:16px 0">Brak zaplanowanych serwisów w ciągu 30 dni. ✓</div>`;
    return;
  }
  el.innerHTML = `
    ${overdue.length ? `<div style="font-size:12px;margin-bottom:8px;color:var(--red);font-weight:600"><i class="ti ti-alert-triangle"></i> ${overdue.length} zaległych serwisów!</div>` : ''}
    ${upcoming.slice(0,6).map(({v,s,days}) => {
      const t = window.ServiceModule.SERVICE_TYPES[s.type] || { label:'Serwis', icon:'ti-tools', color:'var(--text2)' };
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border);cursor:pointer" onclick="TaxOrderVehicleDetail.open(${v.id})">
        <i class="ti ${t.icon}" style="color:${t.color};font-size:14px;flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:700;font-family:var(--mono)">${esc(v.nrRej)}</div>
          <div style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.label}${s.nextServiceDate ? ' · ' + s.nextServiceDate.slice(0,10) : ''}</div>
        </div>
        <span style="font-size:11px;font-weight:700;flex-shrink:0;color:${days<0?'var(--red)':days<=7?'var(--red)':days<=14?'var(--amber)':'var(--text2)'}">${days<0?Math.abs(days)+'d temu':'za '+days+'d'}</span>
      </div>`;
    }).join('')}`;
}

function _renderFinesDash() {
  const el = document.getElementById('dash-fines');
  if (!el) return;
  if (!window.FinesModule) {
    el.innerHTML = `<div style="font-size:11px;color:var(--text3)"><i class="ti ti-ticket"></i> Mandaty — moduł niedostępny</div>`;
    return;
  }
  const alerts = window.FinesModule.getUnpaidAlertsSync();
  const badge = document.getElementById('fines-nav-badge');
  if (badge) { badge.textContent = alerts.length || ''; badge.style.display = alerts.length ? '' : 'none'; }
  if (!alerts.length) {
    el.innerHTML = `<div style="display:flex;align-items:center;gap:7px">
      <i class="ti ti-circle-check" style="color:var(--green);font-size:16px;flex-shrink:0"></i>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--green)">Mandaty</div>
        <div style="font-size:11px;color:var(--text3)">Brak nieopłaconych</div>
      </div>
      <button onclick="FinesModule.open()" style="margin-left:auto;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Lista</button>
    </div>`;
    return;
  }
  const days = d => { if (!d) return null; const dt = new Date(d.includes('T') ? d : d + 'T00:00:00'); if (isNaN(dt)) return null; const t = new Date(); t.setHours(0,0,0,0); return Math.round((dt-t)/86400000); };
  el.innerHTML = `
    <div style="font-size:12px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--red)">
      <i class="ti ti-alert-triangle"></i>Nieopłacone mandaty (${alerts.length})
      <button onclick="FinesModule.open()" style="margin-left:auto;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Wszystkie</button>
    </div>
    ${alerts.slice(0,4).map(f => {
      const t = window.FinesModule.FINE_TYPES[f.type] || window.FinesModule.FINE_TYPES.inne;
      const dl = days(f.deadline);
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border)">
        <i class="ti ${t.icon}" style="color:${t.color};font-size:13px;flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:700;font-family:var(--mono)">${f.nr_rej||'—'}</div>
          <div style="font-size:11px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.label}${f.amount?' · '+f.amount+' zł':''}</div>
        </div>
        <span style="font-size:11px;font-weight:700;flex-shrink:0;color:${dl===null?'var(--text3)':dl<0?'var(--red)':dl<=3?'var(--red)':'var(--amber)'}">${dl===null?'—':dl<0?Math.abs(dl)+'d temu':'za '+dl+'d'}</span>
      </div>`;
    }).join('')}`;
}

function _renderDriversDash() {
  const el = document.getElementById('dash-drivers');
  if (!el) return;
  if (!window.TaxOrderDrivers) {
    el.innerHTML = `<div style="font-size:11px;color:var(--text3)"><i class="ti ti-id-badge"></i> Kierowcy — moduł niedostępny</div>`;
    return;
  }
  const drivers = window.TaxOrderDrivers.getAll();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const DAYS90 = 90 * 86400000;
  const expiring = drivers
    .filter(d => d.license_expiry)
    .map(d => ({ d, ms: new Date(d.license_expiry) - now }))
    .filter(({ ms }) => ms < DAYS90)
    .sort((a, b) => a.ms - b.ms);
  if (!expiring.length) {
    el.innerHTML = `<div style="display:flex;align-items:center;gap:7px">
      <i class="ti ti-circle-check" style="color:var(--green);font-size:16px;flex-shrink:0"></i>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--green)">Prawa jazdy</div>
        <div style="font-size:11px;color:var(--text3)">Brak wygasających (90 dni)</div>
      </div>
      <button onclick="TaxOrderDrivers.open()" style="margin-left:auto;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Lista</button>
    </div>`;
    return;
  }
  el.innerHTML = `
    <div style="font-size:12px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--amber)">
      <i class="ti ti-id-badge"></i>Prawo jazdy — wygasa wkrótce (${expiring.length})
      <button onclick="TaxOrderDrivers.open()" style="margin-left:auto;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Wszyscy</button>
    </div>
    ${expiring.slice(0, 4).map(({ d, ms }) => {
      const days = Math.round(ms / 86400000);
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border)">
        <i class="ti ti-id-badge" style="color:var(--amber);font-size:13px;flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:700">${esc(d.name)}</div>
          <div style="font-size:11px;color:var(--text2)">${d.license_no ? 'Nr: '+esc(d.license_no) : 'Brak numeru prawa jazdy'}</div>
        </div>
        <span style="font-size:11px;font-weight:700;flex-shrink:0;color:${days<0?'var(--red)':days<=14?'var(--red)':'var(--amber)'}">${days<0?Math.abs(days)+'d temu':'za '+days+'d'}</span>
      </div>`;
    }).join('')}`;
}

function _renderFleetCardsDash() {
  const el = document.getElementById('dash-fleet-cards');
  if (!el) return;
  const cards = window.getFlotCards ? window.getFlotCards() : [];
  if (!cards.length) {
    // Załaduj asynchronicznie i odśwież dashboard po załadowaniu
    if (typeof _loadKarty === 'function' && !window._kartasDashLoading) {
      window._kartasDashLoading = true;
      _loadKarty().then(() => { window._kartasDashLoading = false; _renderFleetCardsDash(); });
    }
    el.innerHTML = `<div style="display:flex;align-items:center;gap:7px">
      <i class="ti ti-circle-check" style="color:var(--green);font-size:16px;flex-shrink:0"></i>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--green)">Karty flotowe</div>
        <div style="font-size:11px;color:var(--text3)">Brak wygasających (30 dni)</div>
      </div>
      <button onclick="showPage('karty')" style="margin-left:auto;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Lista</button>
    </div>`;
    return;
  }
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const DAYS30 = 30 * 86400000;
  const expiring = cards
    .filter(k => k.status !== 'NIEAKTYWNA' && k.expires)
    .map(k => ({ k, ms: new Date(k.expires) - now }))
    .filter(({ ms }) => ms < DAYS30)
    .sort((a, b) => a.ms - b.ms);
  if (!expiring.length) {
    el.innerHTML = `<div style="display:flex;align-items:center;gap:7px">
      <i class="ti ti-circle-check" style="color:var(--green);font-size:16px;flex-shrink:0"></i>
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--green)">Karty flotowe</div>
        <div style="font-size:11px;color:var(--text3)">Brak wygasających (30 dni)</div>
      </div>
      <button onclick="showPage('karty')" style="margin-left:auto;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Lista</button>
    </div>`;
    return;
  }
  el.style.display = '';
  const TYPE_ICON = { PALIWOWA:'ti-gas-station', 'OPŁATY':'ti-road', PARKING:'ti-parking', INNA:'ti-credit-card' };
  el.innerHTML = `
    <div style="font-size:12px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px;color:var(--blue)">
      <i class="ti ti-credit-card"></i>Karty flotowe — wygasają wkrótce (${expiring.length})
      <button onclick="showPage('karty')" style="margin-left:auto;font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Wszystkie</button>
    </div>
    ${expiring.slice(0, 5).map(({ k, ms }) => {
      const days = Math.round(ms / 86400000);
      const icon = TYPE_ICON[k.type] || 'ti-credit-card';
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid var(--border)">
        <i class="ti ${icon}" style="color:var(--blue);font-size:13px;flex-shrink:0"></i>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:700">${k.card_no} <span style="font-weight:400;color:var(--text2)">${k.type}</span></div>
          <div style="font-size:11px;color:var(--text2)">${k.nr_rej ? 'Pojazd: '+k.nr_rej : k.provider || 'Brak pojazdu'}</div>
        </div>
        <span style="font-size:11px;font-weight:700;flex-shrink:0;color:${days<0?'var(--red)':days<=7?'var(--red)':'var(--blue)'}">${days<0?'WYGASŁA '+Math.abs(days)+'d temu':'za '+days+'d'}</span>
      </div>`;
    }).join('')}`;
}

function _renderFleetKpi() {
  const el = document.getElementById('dash-fleet-kpi');
  if (!el) return;
  const allVehs     = window.vehs || [];
  const active      = allVehs.filter(v => v.is_active !== false);
  const archived    = allVehs.length - active.length;
  const svcUpcoming = window.ServiceModule?.getUpcomingServices(14) || [];
  const svcOverdue  = svcUpcoming.filter(x => x.days < 0);
  const allUnpaidFines = (window.FinesModule?.getAllSync?.() || []).filter(f => !f.paid);
  const urgentFines    = window.FinesModule?.getUnpaidAlertsSync?.() || [];
  const finesAmt       = allUnpaidFines.reduce((s,f) => s+(f.amount||0), 0);
  let docAlerts = 0;
  allVehs.forEach(v => { docAlerts += (window.DocumentsModule?.getDocAlerts(v, 30)||[]).length; });
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const withAlerts  = allVehs.filter(v =>
    [v.ocEnd, v.acEnd, v.nextInspection].some(d => d && (new Date(d)-now) < 60*86400000)
  ).length;

  // VIN errors
  const vinErrors = allVehs.filter(v => v.vin && !_validateVin(v.vin).valid).length;

  // Incomplete DT-1
  const dt1Incomplete = allVehs.filter(v => !_dt1Completeness(v).ok).length;

  // TCO YTD (bieżący rok)
  const yrPfx = String(now.getFullYear());
  let tcoYtd = 0;
  allVehs.forEach(v => {
    tcoYtd += (v.fuelHistory||[]).filter(h=>(h.date||'').startsWith(yrPfx)).reduce((s,h)=>s+(h.totalGross||0),0);
    tcoYtd += (v.serviceHistory||[]).filter(h=>(h.date||'').startsWith(yrPfx)).reduce((s,h)=>s+(h.cost||0),0);
  });
  const tcoFmt = tcoYtd >= 1e6
    ? (tcoYtd/1e6).toFixed(1)+'M'
    : tcoYtd >= 1e3 ? Math.round(tcoYtd/1000)+'k' : Math.round(tcoYtd).toString();

  // Tax YTD
  const totalTaxYtd = allVehs.reduce((s,v) => s + ((calcTax(v)||{}).amount||0), 0);
  const taxFmt = totalTaxYtd >= 1e6
    ? (totalTaxYtd/1e6).toFixed(1)+'M'
    : totalTaxYtd >= 1e3 ? Math.round(totalTaxYtd/1e3)+'k' : Math.round(totalTaxYtd).toString();

  const _pln = t('common.pln');
  const chips = [
    { icon:'ti-truck',          label:t('kpi.active'),         val:active.length,           unit:archived>0?`${archived} ${t('common.vehicles')}`:'', color:'var(--blue)',  click:'' },
    { icon:'ti-receipt-2',      label:t('kpi.dt1.tax'),        val:`${taxFmt} ${_pln}`,     unit:`${allVehs.filter(v=>calcTax(v).cat).length} ${t('common.vehicles')}`,  color:'var(--blue)',  click:"showPage('formularze')" },
    { icon:'ti-currency-zloty', label:t('kpi.costs'),          val:`${tcoFmt} ${_pln}`,     unit:'paliwo + serwis YTD',  color:'var(--text)', click:"showPage('raporty')" },
    { icon:'ti-alert-circle',   label:t('kpi.alerts'),         val:withAlerts,              unit:`${t('common.vehicles')} (60 dni)`, color:withAlerts>0?'var(--amber)':'var(--green)', click:'' },
    { icon:'ti-tools',          label:t('kpi.service'),        val:svcUpcoming.length,      unit:svcOverdue.length>0?`${svcOverdue.length} zaległe`:'nadchodzące', color:svcOverdue.length>0?'var(--red)':svcUpcoming.length>0?'var(--amber)':'var(--green)', click:'' },
    { icon:'ti-alert-triangle', label:t('kpi.fines'),          val:allUnpaidFines.length,   unit:urgentFines.length>0?`${urgentFines.length} pilnych ≤14 dni`:finesAmt>0?`${finesAmt.toFixed(0)} ${_pln}`:'', color:urgentFines.length>0?'var(--red)':allUnpaidFines.length>0?'var(--amber)':'var(--green)', click:"FinesModule.open()" },
    { icon:'ti-files',          label:t('kpi.docs'),           val:docAlerts,               unit:'w ciągu 30 dni', color:docAlerts>0?'var(--amber)':'var(--green)', click:'' },
    { icon:'ti-clipboard-check',label:t('kpi.dt1.incomplete'), val:dt1Incomplete,           unit:t('common.vehicles'), color:dt1Incomplete>0?'var(--amber)':'var(--green)', click:"showPage('pojazdy')" },
    { icon:'ti-id',             label:t('kpi.vin.errors'),     val:vinErrors,               unit:vinErrors>0?'do weryfikacji':'', color:vinErrors>0?'var(--red)':'var(--green)', click:'' },
    { icon:'ti-steering-wheel', label:'Kierowcy',               val:(window.TaxOrderDrivers?.getAll()||[]).length, unit:'w kartotece', color:'var(--blue)', click:"TaxOrderDrivers.open()" },
    (() => { const gN=now.getTime(),g24=24*3600000; const gC=allVehs.filter(v=>{const h=Array.isArray(v.gpsHistory)?v.gpsHistory:[];const l=h.filter(x=>x.lat&&x.lon).sort((a,b)=>new Date(b.ts)-new Date(a.ts))[0];return l&&(gN-new Date(l.ts).getTime())<g24;}).length; return { icon:'ti-map-pin', label:'GPS aktywny (24h)', val:gC, unit:'z '+(allVehs.length)+' pojazdów', color:gC>0?'var(--green)':'var(--text3)', click:"showPage('mapa')" }; })(),
  ];

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">
      ${chips.map(c => `
        <div style="background:var(--bg3);border-radius:var(--radius);padding:12px 14px;display:flex;align-items:center;gap:10px;border-left:3px solid ${c.color};transition:background .15s;${c.click?'cursor:pointer':''};"
          ${c.click?`onclick="${c.click}" onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background='var(--bg3)'"`:''}>
          <i class="ti ${c.icon}" style="font-size:20px;color:${c.color};flex-shrink:0"></i>
          <div style="min-width:0">
            <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.label}</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:${c.color};line-height:1.2">${c.val}</div>
            ${c.unit?`<div style="font-size:10px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.unit}</div>`:''}
          </div>
        </div>`).join('')}
    </div>`;
}

function _renderAgeDist() {
  const el = document.getElementById('dash-age-dist');
  if (!el || !vehs.length) return;

  // Rozkład wiekowy
  const GROUPS = [
    { label: '≤ 2018', test: r => r <= 2018, color: 'var(--text3)' },
    { label: '2019–2021', test: r => r >= 2019 && r <= 2021, color: 'var(--text2)' },
    { label: '2022–2023', test: r => r >= 2022 && r <= 2023, color: 'var(--blue)' },
    { label: '≥ 2024 ↓', test: r => r >= 2024, color: 'var(--green)', hint: 'obniżona stawka DT-1' },
  ];
  const total = vehs.length;
  const ageCounts = GROUPS.map(g => ({ ...g, count: vehs.filter(v => g.test(parseInt(v.rok)||0)).length }));

  // Rozkład typów
  const typeMap = {};
  vehs.forEach(v => {
    const typ = (v.typ||'inny').replace(/\s*\(.*\)/, '').trim() || 'inny';
    typeMap[typ] = (typeMap[typ]||0) + 1;
  });
  const types = Object.entries(typeMap).sort((a,b) => b[1]-a[1]).slice(0,6);
  const typeTotal = types.reduce((s,[,n]) => s+n, 0);
  const TYPE_COLORS = ['var(--blue)','var(--green)','var(--amber)','var(--red)','var(--text2)','var(--text3)'];

  const bar = (pct, color) => `<div style="height:8px;border-radius:4px;background:${color};width:${Math.max(pct,2)}%;transition:width .4s"></div>`;

  el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px">Roczniki</div>
      ${ageCounts.map(g => {
        const pct = total ? Math.round(g.count/total*100) : 0;
        return `<div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span style="color:${g.color};font-weight:600">${g.label}</span>
            <span>${g.count} (${pct}%)${g.hint?`<span style="font-size:10px;color:var(--text3);margin-left:4px">${g.hint}</span>`:''}
          </div>
          <div style="background:var(--bg3);border-radius:4px;overflow:hidden">${bar(pct, g.color)}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px">
      <div style="font-size:12px;font-weight:600;color:var(--text2);margin-bottom:10px">Typy pojazdów</div>
      ${types.map(([typ, cnt], i) => {
        const pct = typeTotal ? Math.round(cnt/typeTotal*100) : 0;
        return `<div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span style="color:${TYPE_COLORS[i]};font-weight:600">${typ}</span>
            <span>${cnt} (${pct}%)</span>
          </div>
          <div style="background:var(--bg3);border-radius:4px;overflow:hidden">${bar(pct, TYPE_COLORS[i])}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ==================== FORMULARZE ====================
function tp(id) { return (document.getElementById(id)||{}).value||''; }

function renderFormularze() {
  try {
  const selT = getSelTax();
  const taxable = selT.filter(v=>v.cat);
  const total = totalTax();
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const cats = {};
  selT.forEach(v=>{ if(!v.cat)return; if(!cats[v.cat])cats[v.cat]={count:0,amount:0}; cats[v.cat].count++;cats[v.cat].amount+=v.amount; });
  const groups = [];
  for(let i=0;i<taxable.length;i+=3) groups.push(taxable.slice(i,i+3));
  const yr = document.getElementById('taxYear').value;
  const today = new Date().toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});

  const info = document.getElementById('form-info');
  if(info) info.textContent = `${taxable.length} pojazdów → DT-1(5) + ${groups.length} × DT-1/A(5)`;

  // ===== POMOCNICZE =====
  const tp = id => (document.getElementById(id)||{}).value||'';
  const fv = (val,fallback='') => val||fallback;
  const box = (checked) => checked
    ? '<span style="display:inline-block;width:9px;height:9px;border:1.2px solid #222;vertical-align:middle;background:#fff;position:relative;margin-right:2px"><span style="position:absolute;top:-3px;left:0;font-size:10px;font-family:Arial,sans-serif;font-weight:bold;color:#000">&#10003;</span></span>'
    : '<span style="display:inline-block;width:9px;height:9px;border:1.2px solid #222;vertical-align:middle;background:#fff;margin-right:2px"></span>';

  const catDisplay = cat => String(cat||'').replace(/^D(\d+)$/, 'D.$1');

  // Kategorie D.1-D.15
  const catDefs = [
    ['D1','Samochody ciężarowe o dopuszczalnej masie całkowitej powyżej 3,5 tony do 5,5 tony włącznie',[20,21,22,23]],
    ['D2','Samochody ciężarowe o dopuszczalnej masie całkowitej powyżej 5,5 tony do 9 ton włącznie',[24,25,26,27]],
    ['D3','Samochody ciężarowe o dopuszczalnej masie całkowitej powyżej 9 ton i poniżej 12 ton',[28,29,30,31]],
    ['D4','Ciągniki siodłowe i balastowe przystosowane do używania łącznie z naczepą lub przyczepą o dopuszczalnej masie całkowitej zespołu pojazdów od 3,5 tony i poniżej 12 ton',[32,33,34,35]],
    ['D5','Przyczepy i naczepy, które łącznie z pojazdem silnikowym posiadają dopuszczalną masę całkowitą od 7 ton i poniżej 12 ton, z wyjątkiem związanych wyłącznie z działalnością rolniczą prowadzoną przez podatnika podatku rolnego',[36,37,38,39]],
    ['D6','Autobusy z liczbą miejsc do siedzenia mniejszą niż 22',[40,41,42,43]],
    ['D7','Autobusy z liczbą miejsc do siedzenia równą i wyższą niż 22',[44,45,46,47]],
  ];
  const catDefs2 = [
    ['D8','Dwie osie',[48,49,50,51],'Sam. cięż. ≥12t'],
    ['D9','Trzy osie',[52,53,54,55],'Sam. cięż. ≥12t'],
    ['D10','Cztery osie i więcej',[56,57,58,59],'Sam. cięż. ≥12t'],
    ['D11','Dwie osie',[60,61,62,63],'Ciągniki siodłowe ≥12t'],
    ['D12','Trzy osie i więcej',[64,65,66,67],'Ciągniki siodłowe ≥12t'],
    ['D13','Jedna oś',[68,69,70,71],'Przyczepy i naczepy ≥12t'],
    ['D14','Dwie osie',[72,73,74,75],'Przyczepy i naczepy ≥12t'],
    ['D15','Trzy osie i więcej',[76,77,78,79],'Przyczepy i naczepy ≥12t'],
  ];

  const celMap = {
    'DEKLARACJA SKLADANA DO 15 LUTEGO': '1',
    'POWSTANIE OBOWIAZKU W TRAKCIE ROKU': '2',
    'WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU': '3',
    'ZMIANA MIEJSCA ZAMIESZKANIA LUB SIEDZIBY': '4',
    'KOREKTA DEKLARACJI': '5',
    'PRZEDLUZENIE WYCOFANIA': '6',
  };
  const celNr = celMap[tp('tp-cel')] || '1';

  // ====================================================================
  // DT-1(5) — FORMULARZ GŁÓWNY
  // ====================================================================
  const dt1 = `
  <div class="form-page" style="font-family:'Courier New',Courier,monospace;font-size:7.5pt;background:#fff;color:#000;padding:8mm 10mm;max-width:190mm;margin:0 auto 20px;border:1px solid #888">

    <!-- NAGŁÓWEK -->
    <div style="font-size:6pt;border:0.5px solid #000;padding:2px 4px;margin-bottom:2px;display:flex;justify-content:space-between">
      <span>POLA JASNE WYPEŁNIA PODATNIK, POLA CIEMNE WYPEŁNIA ORGAN PODATKOWY. WYPEŁNIĆ NA MASZYNIE, KOMPUTEROWO LUB RĘCZNIE, DUŻYMI, DRUKOWANYMI LITERAMI, CZARNYM LUB NIEBIESKIM KOLOREM. PRZED WYPEŁNIENIEM NALEŻY ZAPOZNAĆ SIĘ Z OBJAŚNIENIAMI.</span>
    </div>

    <!-- WIERSZ NIP / Nr dok / Status -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
      <tr>
        <td style="border:0.5px solid #000;padding:2px 4px;font-size:6pt;width:55%">1. Identyfikator podatkowy NIP / numer PESEL <sup>(niepotrzebne skreślić)</sup> <b>podatnika</b></td>
        <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:25%">2. Nr dokumentu</td>
        <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:20%">3. Status</td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 6px;font-size:10pt;font-weight:bold;letter-spacing:2px">${tp('tp-nip')}</td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
      </tr>
    </table>

    <!-- TYTUŁ -->
    <div style="display:flex;align-items:stretch;border:0.5px solid #000;margin-bottom:2px">
      <div style="padding:4px 8px;border-right:0.5px solid #000;font-size:16pt;font-weight:bold;font-family:Arial,sans-serif;display:flex;align-items:center;min-width:60px">DT-1</div>
      <div style="padding:4px 8px;flex:1">
        <div style="font-size:9pt;font-weight:bold;font-family:Arial,sans-serif">DEKLARACJA NA PODATEK OD ŚRODKÓW TRANSPORTOWYCH</div>
        <div style="font-size:7.5pt;margin-top:2px">na <span style="border:0.5px solid #000;padding:1px 4px;font-weight:bold">&nbsp;4.&nbsp;Rok:&nbsp;${yr}&nbsp;</span></div>
        <div style="font-size:6pt;margin-top:3px;color:#444">Podstawa prawna: Art. 9 ust. 6 pkt 1 i 2 ustawy z dnia 12 stycznia 1991 r. o podatkach i opłatach lokalnych (Dz. U. z 2025 r. poz. 707). Stawki: Uchwała XXIX/1065/2025 Rady m.st. Warszawy z 20.11.2025 r.</div>
      </div>
      <div style="padding:4px 8px;border-left:0.5px solid #000;font-size:7pt;text-align:right;white-space:nowrap">DT-1<sub>(5)</sub>&nbsp;&nbsp;1/4</div>
    </div>

    <!-- A. MIEJSCE SKŁADANIA -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">A. MIEJSCE SKŁADANIA DEKLARACJI</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;margin-bottom:2px">
      <span style="font-size:6pt;font-weight:bold">5. Nazwa i adres siedziby organu podatkowego</span><br>
      <span style="font-size:8pt;font-weight:bold">${tp('tp-organ')||'PREZYDENT M.ST. WARSZAWY, CENTRUM OBSŁUGI PODATNIKA, UL. OBOZOWA 57, 01-161 WARSZAWA, POLSKA'}</span>
    </div>

    <!-- B. DANE PODATNIKA -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">B. DANE PODATNIKA</div>
    <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:6.5pt;font-style:italic;margin-bottom:0">* - dotyczy podatnika niebędącego osobą fizyczną &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ** - dotyczy podatnika będącego osobą fizyczną</div>

    <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;background:#d8d8d8;margin-bottom:0">B.1. DANE IDENTYFIKACYJNE</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:7.5pt;margin-bottom:0">
      <span style="font-size:6pt;font-weight:bold">6. Rodzaj podatnika</span> (zaznaczyć właściwy kwadrat):<br>
      <span style="margin-left:10px">${box(true)}&nbsp;1. podatnik niebędący osobą fizyczną &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${box(false)}&nbsp;2. osoba fizyczna</span>
    </div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;margin-bottom:0">
      <div style="font-size:6pt;font-weight:bold">7. Nazwa pełna * / Nazwisko, pierwsze imię, data urodzenia **</div>
      <div style="font-size:9pt;font-weight:bold;margin-top:2px">${tp('tp-nazwa')}</div>
    </div>

    <!-- Adres -->
    <div style="border:0.5px solid #000;border-top:none;font-size:7pt;margin-bottom:2px">
      <div style="font-weight:bold;padding:1px 4px;background:#e8e8e8;font-family:Arial,sans-serif">B.2. ADRES SIEDZIBY * / ADRES ZAMIESZKANIA **</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="border-right:0.5px solid #000;border-bottom:0.5px solid #000;padding:2px 4px;width:15%"><div style="font-size:6pt">8. Kraj</div><div style="font-weight:bold">Polska</div></td>
          <td style="border-right:0.5px solid #000;border-bottom:0.5px solid #000;padding:2px 4px;width:25%"><div style="font-size:6pt">9. Województwo</div><div style="font-weight:bold">${tp('tp-woj')||'MAZOWIECKIE'}</div></td>
          <td style="border-right:0.5px solid #000;border-bottom:0.5px solid #000;padding:2px 4px;width:25%"><div style="font-size:6pt">10. Powiat</div><div style="font-weight:bold">WARSZAWA</div></td>
          <td style="border-bottom:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">11. Gmina</div><div style="font-weight:bold">BIAŁOŁĘKA</div></td>
        </tr>
        <tr>
          <td colspan="2" style="border-right:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">12. Ulica</div><div style="font-weight:bold">${tp('tp-ulica')}</div></td>
          <td style="border-right:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">13. Nr domu</div><div style="font-weight:bold">${tp('tp-dom')}</div></td>
          <td style="padding:2px 4px"><div style="font-size:6pt">14. Nr lokalu</div><div style="font-weight:bold">${tp('tp-lokal')||'—'}</div></td>
        </tr>
        <tr>
          <td colspan="2" style="border-right:0.5px solid #000;border-top:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">15. Miejscowość</div><div style="font-weight:bold">${tp('tp-miasto')}</div></td>
          <td style="border-right:0.5px solid #000;border-top:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">16. Kod pocztowy</div><div style="font-weight:bold">${tp('tp-kod')}</div></td>
          <td style="border-top:0.5px solid #000;padding:2px 4px"><div style="font-size:6pt">17. Poczta</div><div style="font-weight:bold">${tp('tp-miasto')}</div></td>
        </tr>
      </table>
    </div>

    <!-- C. OBOWIĄZEK -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">C. OBOWIĄZEK SKŁADANIA DEKLARACJI</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:7.5pt;margin-bottom:2px">
      <div style="font-size:6pt;font-weight:bold">18. Przyczyny złożenia deklaracji</div>
      <div style="margin-top:2px">
        ${box(celNr==='1')}&nbsp;1. deklaracja składana w terminie do dnia 15 lutego roku podatkowego &nbsp;&nbsp;
        ${box(celNr==='2')}&nbsp;2. powstanie obowiązku podatkowego w trakcie roku podatkowego<br>
        ${box(celNr==='3')}&nbsp;3. wygaśnięcie obowiązku podatkowego &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ${box(celNr==='4')}&nbsp;4. zmiana miejsca zamieszkania lub siedziby<br>
        ${box(celNr==='5')}&nbsp;5. korekta deklaracji &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        ${box(celNr==='6')}&nbsp;6. przedłużenie okresu czasowego wycofania pojazdu z ruchu
      </div>
    </div>

    <!-- D. DANE DOTYCZĄCE -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">D. DANE DOTYCZĄCE PRZEDMIOTÓW OPODATKOWANIA (z wyjątkiem środków transportowych zwolnionych z podatku)</div>
    <div style="border:0.5px solid #000;border-top:none;font-size:6.5pt;padding:2px 5px;margin-bottom:0;font-style:italic">W przypadku zaznaczenia w poz.18 kwadratu nr 2, 3, 5 lub 6 podatnik wypełnia deklarację i załącznik tylko w zakresie pojazdów, co do których obowiązek podatkowy powstał, wygasł lub złożona wcześniej deklaracja została wypełniona nieprawidłowo.</div>

    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <thead>
        <tr style="background:#e8e8e8">
          <th style="border:0.5px solid #000;padding:2px 4px;text-align:left;width:38%">Rodzaje środków transportowych</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:center;width:15%">Liczba pojazdów niepozostających we współwłasności</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:center;width:15%">Liczba pojazdów pozostających we współwłasności ¹)</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:center;width:15%">Liczba pojazdów pozostających we współwłasności ²)</th>
          <th style="border:0.5px solid #000;border-left:none;padding:2px 4px;text-align:right;width:17%">Kwota podatku zł, gr</th>
        </tr>
        <tr style="background:#e8e8e8">
          <th style="border:0.5px solid #000;border-top:none;padding:1px 4px;text-align:center">a</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">b</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">c</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">d</th>
          <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:1px 4px;text-align:center">e</th>
        </tr>
      </thead>
      <tbody>
        ${catDefs.map(([cat,lbl,fn])=>{
          const d=cats[cat]||{count:0,amount:0};const filled=d.count>0;
          return `<tr style="${filled?'background:#f5fff5':''}">
            <td style="border:0.5px solid #000;border-top:none;padding:3px 4px"><b>${catDisplay(cat)}</b>&nbsp;${lbl}</td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
              <span style="font-size:5.5pt;color:#666">${fn[0]}.</span>&nbsp;<b>${filled?d.count:''}</b></td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
              <span style="font-size:5.5pt;color:#666">${fn[1]}.</span></td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
              <span style="font-size:5.5pt;color:#666">${fn[2]}.</span></td>
            <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:right;color:${filled?'#006600':'inherit'}">
              <span style="font-size:5.5pt;color:#666">${fn[3]}.</span>&nbsp;<b>${filled?d.amount.toFixed(2):''}</b></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <!-- Podsekcje D.8-D.15 -->
    ${[
      {title:'Samochody ciężarowe o dopuszczalnej masie całkowitej równej lub wyższej niż 12 ton', cats:['D8','D9','D10'], labels:['Dwie osie','Trzy osie','Cztery osie i więcej'], fns:[[48,49,50,51],[52,53,54,55],[56,57,58,59]]},
      {title:'Ciągniki siodłowe i balastowe przystosowane do używania łącznie z naczepą lub przyczepą o dopuszczalnej masie całkowitej zespołu pojazdów równej lub wyższej niż 12 ton', cats:['D11','D12'], labels:['Dwie osie','Trzy osie i więcej'], fns:[[60,61,62,63],[64,65,66,67]]},
      {title:'Przyczepy i naczepy, które łącznie z pojazdem silnikowym posiadają dopuszczalną masę całkowitą równą lub wyższą niż 12 ton, z wyjątkiem związanych wyłącznie z działalnością rolniczą prowadzoną przez podatnika podatku rolnego', cats:['D13','D14','D15'], labels:['Jedna oś','Dwie osie','Trzy osie i więcej'], fns:[[68,69,70,71],[72,73,74,75],[76,77,78,79]]},
    ].map(sec=>`
    <div style="border:0.5px solid #000;border-top:none;font-size:6.5pt;padding:2px 5px;text-align:center;font-weight:bold;background:#f0f0f0">${sec.title}</div>
    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <thead><tr style="background:#e8e8e8">
        <th style="border:0.5px solid #000;border-top:none;padding:2px 4px;width:20%">Liczba osi</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:center;width:20%">Liczba pojazdów niepozostających we współwłasności</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:center;width:20%">Liczba pojazdów pozostających we współ. ¹)</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:center;width:20%">Liczba pojazdów pozostających we współ. ²)</th>
        <th style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;text-align:right;width:20%">Kwota podatku zł, gr</th>
      </tr></thead>
      <tbody>${sec.cats.map((cat,i)=>{
        const d=cats[cat]||{count:0,amount:0};const filled=d.count>0;const fn=sec.fns[i];
        return `<tr style="${filled?'background:#f5fff5':''}">
          <td style="border:0.5px solid #000;border-top:none;padding:3px 4px"><b>${catDisplay(cat)}</b>&nbsp;${sec.labels[i]}</td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
            <span style="font-size:5.5pt;color:#666">${fn[0]}.</span>&nbsp;<b>${filled?d.count:''}</b></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
            <span style="font-size:5.5pt;color:#666">${fn[1]}.</span></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:center">
            <span style="font-size:5.5pt;color:#666">${fn[2]}.</span></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px;text-align:right;color:${filled?'#006600':'inherit'}">
            <span style="font-size:5.5pt;color:#666">${fn[3]}.</span>&nbsp;<b>${filled?d.amount.toFixed(2):''}</b></td>
        </tr>`;}).join('')}
      </tbody>
    </table>`).join('')}

    <!-- E. KWOTA PODATKU -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-top:1px">E. KWOTA PODATKU</div>
    <table style="width:100%;border-collapse:collapse;font-size:7.5pt">
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px;width:75%">
          <b>80.</b> Razem kwota podatku (suma kwot z kol. e w części D)<br>
          <span style="font-size:6pt">Suma kwot z kol. e w części D.</span>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;text-align:right;font-weight:bold;font-size:10pt;color:#006600">${total.toFixed(2)}&nbsp;zł</td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px">
          <b>81.</b> Kwota I raty podatku do zapłaty — zaokrąglona do pełnych złotych<br>
          <span style="font-size:6pt">(termin: 15 lutego)</span>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;text-align:right;font-weight:bold;color:#185FA5">${r1}&nbsp;zł</td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px">
          <b>82.</b> Kwota II raty podatku do zapłaty — zaokrąglona do pełnych złotych<br>
          <span style="font-size:6pt">(termin: 15 września)</span>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;text-align:right;font-weight:bold;color:#185FA5">${r2}&nbsp;zł</td>
      </tr>
    </table>

    <!-- F. ZAŁĄCZNIKI -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-top:1px">F. INFORMACJA O ZAŁĄCZNIKACH</div>
    <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:7.5pt;margin-bottom:1px">
      <b>83.</b> Liczba składanych załączników DT-1/A: <span style="border:0.5px solid #000;padding:1px 6px;font-weight:bold;font-size:11pt">&nbsp;${groups.length}&nbsp;</span>
    </div>

    <!-- G. PODPIS -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px">G. PODPIS PODATNIKA / OSOBY REPREZENTUJĄCEJ PODATNIKA</div>
    <table style="width:100%;border-collapse:collapse;font-size:7pt">
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px;width:33%">
          <div style="font-size:6pt"><b>84. Imię</b></div>
          <div style="font-weight:bold;margin-top:4px">${tp('tp-imie')}</div>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;width:34%">
          <div style="font-size:6pt"><b>85. Nazwisko</b></div>
          <div style="font-weight:bold;margin-top:4px">${tp('tp-nazwisko')}</div>
        </td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;width:33%">
          <div style="font-size:6pt"><b>86. Data wypełnienia</b> (dzień - miesiąc - rok)</div>
          <div style="margin-top:4px">${today}</div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border:0.5px solid #000;border-top:none;padding:8px 5px">
          <span style="font-size:6pt"><b>87. Podpis (pieczątka) podatnika / osoby reprezentującej podatnika</b></span>
          <div style="height:20px;border-bottom:0.5px solid #000;margin:4px 20px 0"></div>
        </td>
      </tr>
    </table>

    <!-- H. ADNOTACJE -->
    <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-top:1px">H. ADNOTACJE ORGANU PODATKOWEGO</div>
    <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:6.5pt"><b>88. Uwagi organu podatkowego</b><div style="height:20px"></div></div>
    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:3px 5px;width:50%"><b>89. Identyfikator przyjmującego formularz</b><div style="height:12px"></div></td>
        <td style="border:0.5px solid #000;border-top:none;border-left:none;padding:3px 5px;width:50%"><b>90. Podpis przyjmującego formularz</b><div style="height:12px"></div></td>
      </tr>
    </table>

    <!-- POUCZENIA -->
    <div style="font-size:6pt;margin-top:3px;padding:2px 5px;border:0.5px solid #ccc">
      <b>Pouczenia:</b> W przypadku niewpłacenia w obowiązującym terminie kwoty podatku (raty podatku) od środków transportowych z poz.81 i 82 lub wpłacenia jej w niepełnej wysokości, niniejsza deklaracja stanowi podstawę do wystawienia tytułu wykonawczego. Za podanie nieprawdy lub zatajenie prawdy i przez to narażenie podatku na uszczuplenie grozi odpowiedzialność przewidziana w Kodeksie karnym skarbowym.
    </div>
  </div>`;

  // ====================================================================
  // DT-1/A(5) — ZAŁĄCZNIKI (po 3 pojazdy)
  // ====================================================================
  const zawieszMap = z => ({
    'pneumatyczne': [true,false,false],
    'równoważne':   [false,true,false],
    'inne':         [false,false,true],
  }[z||'pneumatyczne']||[true,false,false]);

  const euroMap = e => {
    const s=(e||'').toUpperCase();
    if(s.includes('6'))return[false,false,false,false,false,false,true];
    if(s.includes('5'))return[false,false,false,false,false,true,false];
    if(s.includes('4'))return[false,false,false,false,true,false,false];
    if(s.includes('3'))return[false,false,false,true,false,false,false];
    if(s.includes('2'))return[false,false,true,false,false,false,false];
    if(s.includes('1'))return[false,true,false,false,false,false,false];
    return[true,false,false,false,false,false,false]; // Euro 0
  };

  const vehBlock = (v, blockNum) => {
    if(!v) return `
      <div style="border:0.5px solid #000;border-top:none;background:#f8f8f8;padding:2px 5px;font-size:6pt;font-weight:bold;font-family:Arial,sans-serif">
        B.${blockNum}. DANE SZCZEGÓŁOWE DOTYCZĄCE ŚRODKA TRANSPORTOWEGO ${blockNum} — pole niewypełnione
      </div>
      <div style="border:0.5px solid #000;border-top:none;padding:10px 5px;font-size:6pt;color:#aaa;text-align:center">— —</div>`;

    const zaw = zawieszMap(v.zawieszenie);
    const eur = euroMap(v.euro);
    const isCiagnik = (v.typ||'').toLowerCase().includes('ciąg')||(v.typ||'').toLowerCase().includes('ciag');
    const dmc = (v.dmc||v.dmcMax)?((v.dmc||v.dmcMax)/1000).toFixed(3):'';
    const dmcZ = v.dmcZespolu>0?((v.dmcZespolu/1000).toFixed(3)):'';
    const tax = calcTax(v);

    return `
    <div style="border:0.5px solid #000;border-top:none;background:#d8d8d8;padding:2px 5px;font-size:6.5pt;font-weight:bold;font-family:Arial,sans-serif">
      B.${blockNum}. DANE SZCZEGÓŁOWE DOTYCZĄCE ŚRODKA TRANSPORTOWEGO ${blockNum}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:6.5pt">
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <b>1. Dane dotyczące własności albo współwłasności:</b>
          ${box(true)}&nbsp;1. właściciel &nbsp; ${box(false)}&nbsp;2. współ. I &nbsp; ${box(false)}&nbsp;3. współ. II
        </td>
      </tr>
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <b>2. Rodzaj środka transportowego:</b>
          ${box(!(v.typ||'').toLowerCase().includes('nacz')&&!(v.typ||'').toLowerCase().includes('przy')&&!(v.typ||'').toLowerCase().includes('auto')&&!isCiagnik)}&nbsp;1. samochód ciężarowy &nbsp;
          ${box(isCiagnik)}&nbsp;2. ciągnik siodłowy &nbsp; ${box(false)}&nbsp;3. ciągnik balastowy &nbsp;
          ${box((v.typ||'').toLowerCase().includes('przy'))}&nbsp;4. przyczepa &nbsp;
          ${box((v.typ||'').toLowerCase().includes('nacz'))}&nbsp;5. naczepa &nbsp;
          ${box((v.typ||'').toLowerCase().includes('auto'))}&nbsp;6. autobus
        </td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:2px 4px;width:25%">
          <div style="font-size:5.5pt;font-weight:bold">3. Data pierwszej rejestracji na terytorium RP</div>
          <div style="margin-top:2px">${v.dataRejestracji||v.dataRej||'—'}</div>
        </td>
        <td colspan="5" style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">4. Numer rejestracyjny pojazdu</div>
          <div style="font-weight:bold;font-size:10pt;letter-spacing:1px">${esc(v.nrRej)}</div>
        </td>
      </tr>
      <tr>
        <td colspan="3" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">5. Numer Identyfikacyjny VIN / nadwozia / podwozia / ramy <sup>1)</sup></div>
          <div style="font-weight:bold;font-size:8pt;letter-spacing:1px">${esc(v.vin||'—')}</div>
        </td>
        <td colspan="3" style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">6. Marka, typ, model pojazdu</div>
          <div style="font-weight:bold">${esc(v.marka)} ${esc(v.model)}</div>
        </td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:2px 4px;width:14%">
          <div style="font-size:5.5pt;font-weight:bold">7. Rok produkcji</div>
          <div style="font-weight:bold">${v.rok||'—'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:22%">
          <div style="font-size:5.5pt;font-weight:bold">8. Data nabycia</div>
          <div>${v.dataNabycia||'—'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:22%">
          <div style="font-size:5.5pt;font-weight:bold">9. Data zbycia</div>
          <div>${v.dataZbycia||'—'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:21%">
          <div style="font-size:5.5pt;font-weight:bold">10. Data cz. wycofania z ruchu</div>
          <div>—</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px;width:21%">
          <div style="font-size:5.5pt;font-weight:bold">12. Data wyrejestrowania</div>
          <div>—</div>
        </td>
      </tr>
      <tr>
        <td style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">13. DMC pojazdu (t)</div>
          <div style="font-weight:bold">${dmc}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">14. Masa własna ciągnika (t)</div>
          <div>${isCiagnik?dmc:'—'}</div>
        </td>
        <td colspan="3" style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">15. DMC zespołu pojazdów (t)</div>
          <div style="font-weight:bold">${dmcZ||'—'}</div>
        </td>
        <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">16. Liczba osi</div>
          <div style="font-weight:bold;font-size:10pt">${v.osie||2}</div>
        </td>
      </tr>
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">17. Rodzaj zawieszenia:</div>
          ${box(zaw[0])}&nbsp;1. pneumatyczne &nbsp;&nbsp;
          ${box(zaw[1])}&nbsp;2. równoważne z pneumatycznym &nbsp;&nbsp;
          ${box(zaw[2])}&nbsp;3. inny system zawieszenia
        </td>
      </tr>
      <tr>
        <td colspan="6" style="border:0.5px solid #000;border-top:none;padding:2px 4px">
          <div style="font-size:5.5pt;font-weight:bold">20. Wpływ pojazdu silnikowego na środowisko naturalne (emisja spalin):</div>
          ${box(!eur.slice(1).some(Boolean))}&nbsp;Euro 0 &nbsp;
          ${box(eur[1])}&nbsp;Euro I/I &nbsp;
          ${box(eur[2])}&nbsp;Euro II/II &nbsp;
          ${box(eur[3])}&nbsp;Euro III/III &nbsp;
          ${box(eur[4])}&nbsp;Euro IV/IV &nbsp;
          ${box(eur[5])}&nbsp;Euro V/V &nbsp;
          ${box(eur[6])}&nbsp;<b>Euro VI/VI</b>
        </td>
      </tr>
      <tr style="background:#f0fff0">
        <td colspan="4" style="border:0.5px solid #000;border-top:none;padding:3px 4px">
          <div style="font-size:5.5pt;font-weight:bold">21. Kwota podatku</div>
          <div style="font-weight:bold;font-size:11pt;color:#006600">${(tax.amount||0).toFixed(2)}&nbsp;zł</div>
          <div style="font-size:5.5pt;color:#555">Kat. ${tax.cat||'—'} | Stawka: ${(tax.rate||0).toLocaleString('pl-PL')} zł | ${v.miesiacePodatku||12} mies.${(parseInt(v.rok)||0)>=2024?' [§2]':''}</div>
        </td>
        <td colspan="2" style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 4px">
          <div style="font-size:5.5pt;font-weight:bold">22. Kwota podatku zapłaconego</div>
          <div style="height:16px"></div>
        </td>
      </tr>
    </table>`;
  };

  const dt1aForms = groups.map((grp, gi) => {
    const attNo = gi+1, attTot = groups.length;
    const nip = tp('tp-nip');
    const nazwa = tp('tp-nazwa');
    return `
    <div class="form-page" style="font-family:'Courier New',Courier,monospace;font-size:7.5pt;background:#fff;color:#000;padding:8mm 10mm;max-width:190mm;margin:0 auto 20px;border:1px solid #888;page-break-before:always">

      <!-- NAGŁÓWEK DT-1/A -->
      <div style="font-size:6pt;border:0.5px solid #000;padding:2px 4px;margin-bottom:2px">
        POLA JASNE WYPEŁNIA PODATNIK, POLA CIEMNE WYPEŁNIA ORGAN PODATKOWY. WYPEŁNIĆ NA MASZYNIE, KOMPUTEROWO LUB RĘCZNIE, DUŻYMI, DRUKOWANYMI LITERAMI, CZARNYM LUB NIEBIESKIM KOLOREM. PRZED WYPEŁNIENIEM NALEŻY ZAPOZNAĆ SIĘ Z OBJAŚNIENIAMI.
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:2px">
        <tr>
          <td style="border:0.5px solid #000;padding:2px 4px;font-size:6pt;width:55%">1. Identyfikator podatkowy NIP / numer PESEL <sup>(niepotrzebne skreślić)</sup> <b>podatnika</b></td>
          <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:25%">2. Nr dokumentu</td>
          <td style="border:0.5px solid #000;border-left:none;padding:2px 4px;font-size:6pt;width:20%">3. Status</td>
        </tr>
        <tr>
          <td style="border:0.5px solid #000;border-top:none;padding:3px 6px;font-size:10pt;font-weight:bold;letter-spacing:2px">${nip}</td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
          <td style="border:0.5px solid #000;border-left:none;border-top:none;padding:3px 6px"></td>
        </tr>
      </table>

      <!-- TYTUŁ DT-1/A -->
      <div style="display:flex;align-items:stretch;border:0.5px solid #000;margin-bottom:2px">
        <div style="padding:4px 8px;border-right:0.5px solid #000;font-size:14pt;font-weight:bold;font-family:Arial,sans-serif;display:flex;align-items:center;min-width:70px">DT-1/A</div>
        <div style="padding:4px 8px;flex:1">
          <div style="font-size:9pt;font-weight:bold;font-family:Arial,sans-serif">ZAŁĄCZNIK DO DEKLARACJI DT-1</div>
          <div style="font-size:6pt;margin-top:2px">Formularz DT-1/A może być składany jedynie jako załącznik do deklaracji DT-1.</div>
        </div>
        <div style="padding:4px 8px;border-left:0.5px solid #000;text-align:center;min-width:80px">
          <div style="font-size:6pt;font-weight:bold">4. Numer załącznika</div>
          <div style="font-weight:bold;font-size:16pt;color:#185FA5">${attNo}&nbsp;/&nbsp;${attTot}</div>
        </div>
        <div style="padding:4px 6px;border-left:0.5px solid #000;font-size:7pt;text-align:right;white-space:nowrap">DT-1/A<sub>(5)</sub>&nbsp;1/2</div>
      </div>

      <!-- A. DANE PODATNIKA -->
      <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">A. DANE PODATNIKA</div>
      <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:6.5pt;font-style:italic">* - dotyczy podatnika niebędącego osobą fizyczną &nbsp;&nbsp;&nbsp; ** - dotyczy podatnika będącego osobą fizyczną</div>
      <div style="border:0.5px solid #000;border-top:none;padding:2px 5px;font-size:7.5pt">
        <span style="font-size:6pt;font-weight:bold">5. Rodzaj podatnika:</span>
        ${box(true)}&nbsp;1. podatnik niebędący osobą fizyczną &nbsp;&nbsp;&nbsp;&nbsp; ${box(false)}&nbsp;2. osoba fizyczna
      </div>
      <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:8pt;font-weight:bold;margin-bottom:2px">${nazwa}</div>

      <!-- B. DANE ŚRODKÓW TRANSPORTOWYCH -->
      <div style="background:#2a2a2a;color:#fff;font-size:7pt;font-family:Arial,sans-serif;font-weight:bold;padding:2px 5px;margin-bottom:0">B. DANE DOTYCZĄCE ŚRODKÓW TRANSPORTOWYCH</div>
      <div style="border:0.5px solid #000;border-top:none;background:#e0e0e0;font-size:7pt;font-weight:bold;font-family:Arial,sans-serif;padding:2px 5px;margin-bottom:0">B.1. DANE SZCZEGÓŁOWE DOTYCZĄCE ŚRODKA TRANSPORTOWEGO</div>

      ${vehBlock(grp[0]||null, 1)}
      ${vehBlock(grp[1]||null, 2)}
      ${vehBlock(grp[2]||null, 3)}

      <div style="border:0.5px solid #000;border-top:none;padding:3px 5px;font-size:6pt;color:#555;margin-top:1px">
        NIP: ${nip} | ${nazwa} | Rok: ${yr} | Załącznik ${attNo}/${attTot} | Stawki: Uchwała XXIX/1065/2025 m.st. Warszawa
      </div>
    </div>`;
  }).join('');

  const container = document.getElementById('forms-container');
  if(container) container.innerHTML = taxable.length===0
    ? '<div class="wbox"><i class="ti ti-alert-triangle"></i>Brak zaznaczonych pojazdów z kategorią podatkową. Przejdź do zakładki <strong>Pojazdy</strong> i zaznacz pojazdy.</div>'
    : dt1 + dt1aForms;
  } catch(e) { console.error("renderFormularze:",e.message); }
}




// ==================== EKSPORT PD ====================
function updatePD() {
  const taxable = getSelTax().filter(v=>v.cat);
  const total = taxable.reduce((s,v)=>s+(v.amount||0),0);
  const pdEl = document.getElementById('pd-taxable'); if(pdEl) pdEl.textContent = taxable.length;
  const ptEl = document.getElementById('pd-total'); if(ptEl) ptEl.textContent = fmt2(total)+' zł';
  const cntEl = document.getElementById('pd-cnt'); if(cntEl) cntEl.textContent = taxable.length;
}

function pdZaw(z){const s=(z||'').toLowerCase();if(s.includes('równo')||s.includes('rowno'))return'ROWNOWAZNE Z PNEUMATYCZNYM';if(s.includes('inne')||s.includes('inny'))return'INNY';return'PNEUMATYCZNE';}
function pdEuroW(e){const s=(e||'').toLowerCase();if(s.includes('elektryczny'))return'POJAZD ELEKTRYCZNY';if(s.includes('hybr'))return'POJAZD HYBRYDOWY';if(s.includes('gaz'))return'POJAZD NAPEDZANY GAZEM ZIEMNYM';if(s.includes('wodor'))return'POJAZD NAPEDZANY WODOREM';return'EURO POJAZD SPALINOWY';}
function pdEuroL(e){const s=(e||'').toUpperCase();if(s.includes('6'))return'EURO 6/VI';if(s.includes('5'))return'EURO 5/V';if(s.includes('4'))return'EURO 4/IV';if(s.includes('3'))return'EURO 3/III';if(s.includes('2'))return'EURO 2/II';if(s.includes('1'))return'EURO 1/I';return'EURO 0';}
function pdTyp(typ){const t=(typ||'').toLowerCase();if(t.includes('ciągnik siodłowy'))return'CIAGNIK SIODLOWY';if(t.includes('ciągnik balastowy'))return'CIAGNIK BALASTOWY';if(t.includes('naczepa'))return'NACZEPA';if(t.includes('przyczepa'))return'PRZYCZEPA';if(t.includes('autobus'))return'AUTOBUS';return'SAMOCHOD CIEZAROWY';}

function exportPD() {
  const taxable = getSelTax().filter(v=>v.cat);
  if(!taxable.length){toast('⚠ Brak pojazdów z kategorią podatkową!');return;}
  const wb = XLSX.utils.book_new();
  const nip = tp('tp-nip');
  const nazwa = tp('tp-nazwa');
  const yr = document.getElementById('taxYear').value;
  const cel = tp('tp-cel');

  const ws1 = XLSX.utils.aoa_to_sheet([
    ['Rodzaj podatnika','Typ identyfikatora','Identyfikator','REGON','Imię','Nazwisko','Data urodzenia','Nazwa pełna','Nazwa skrócona','Kraj zamieszkania','Kod pocztowy','Województwo','Powiat','Gmina','Miejscowość','Ulica','Nr domu','Nr lokalu','Poczta'],
    ['SPOLKA KAPITALOWA','NIP',parseInt(nip)||nip,tp('tp-regon')||null,null,null,null,nazwa,null,'POLSKA',tp('tp-kod'),tp('tp-woj')||'MAZOWIECKIE','WARSZAWA','WARSZAWA',tp('tp-miasto').toUpperCase(),tp('tp-ulica').toUpperCase(),tp('tp-dom'),tp('tp-lokal')||null,tp('tp-miasto').toUpperCase()]
  ]);
  XLSX.utils.book_append_sheet(wb,ws1,'Dane Podatnika');

  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Cel','Podmiot składający deklarację','Sposób złożenia','Cel złożenia deklaracji korygowanej','Zmiana miejsca zamieszkania lub siedziby','Data zmiany miejsca zamieszkania lub siedziby'],
    [cel,'WLASCICIEL','PAPIEROWY','NOWA DEKLARACJA',null,null]
  ]);
  XLSX.utils.book_append_sheet(wb,ws2,'Informacje Ogólne');

  const hdrs=['Rodzaj środka transportu','Nr rejestracyjny','VIN','Dopuszczalna masa całkowita pojazdu','Masa własna ciągnika siodłowego','Dopuszczalna masa całkowita zespołu pojazdów','Marka/model/typ','Rok produkcji','Liczba osi pojazdu','Rodzaj zawieszenia','Opis rodzaju zawieszenia','Wpływ na środowisko naturalne','Poziom emisji spalin','Liczba miejsc do siedzenia','Wybierz zdarzenie opisujące pojazd','Data pierwszej rejestracji na terytorium RP','Data Nabycia','Środek transportowy był czasowo wycofany z ruchu od','Środek transportowy był czasowo wycofany z ruchu do','Data sprzedaży/wyrejestrowania','Data zdarzenia powodującego powstanie ostatniego obowiązku podatkowego','Kwota podatku zapłaconego'];
  const rows = taxable.map(v=>{
    const isCiagnik=(v.typ||'').toLowerCase().includes('ciagnik')||(v.typ||'').toLowerCase().includes('ciągnik');
    const _dmc=v.dmc||v.dmcMax||0;
    return [pdTyp(v.typ),v.nrRej.toUpperCase(),(v.vin||'').toUpperCase(),_dmc/1000,isCiagnik?_dmc/1000:null,v.dmcZespolu>0?v.dmcZespolu/1000:null,`${v.marka.toUpperCase()}/${v.model.toUpperCase()}`,String(v.rok),parseInt(v.osie||v.liczbaOsi)||2,pdZaw(v.zawieszenie),null,pdEuroW(v.euro),pdEuroL(v.euro),null,'BRAK ZDARZEN',null,null,null,null,null,null,Math.round(v.amount*100)/100];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([hdrs,...rows]);
  XLSX.utils.book_append_sheet(wb,ws3,'Środek transportu');

  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Cel',null,'Rodzaj Środka transportu',null,'Rodzaj zawieszenia',null,'Wpływ na środowisko naturalne',null,'Poziom emisji spalin',null,'Wybierz zdarzenie opisujące pojazd'],
    ['DEKLARACJA SKLADANA DO 15 LUTEGO',null,'SAMOCHOD CIEZAROWY',null,'PNEUMATYCZNE',null,'EURO POJAZD SPALINOWY',null,'EURO 0',null,'BRAK ZDARZEN'],
    ['WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU',null,'CIAGNIK SIODLOWY',null,'ROWNOWAZNE Z PNEUMATYCZNYM',null,'INSTALACJA GAZOWA',null,'EURO 1/I',null,'NABYCIE POJAZDU CZASOWO WYCOFANEGO'],
    ['KOREKTA DEKLARACJI',null,'CIAGNIK BALASTOWY',null,'INNY',null,'POJAZD ELEKTRYCZNY',null,'EURO 2/II',null,'NABYCIE/ZAREJESTROWANIE POJAZDU'],
    ['POWSTANIE OBOWIAZKU W TRAKCIE ROKU',null,'PRZYCZEPA',null,null,null,'POJAZD HYBRYDOWY',null,'EURO 3/III',null,'POJAZD ZOSTAL SPRZEDANY'],
    [null,null,'NACZEPA',null,null,null,'POJAZD NAPEDZANY GAZEM ZIEMNYM',null,'EURO 4/IV',null,'POJAZD ZOSTAL WYREJESTROWANY'],
    [null,null,'AUTOBUS',null,null,null,'POJAZD NAPEDZANY WODOREM',null,'EURO 5/V',null,'POJAZD ZOSTAL CZASOWO WYLACZONY Z RUCHU'],
    [null,null,null,null,null,null,null,null,'EURO 6/VI',null,'POJAZD ZOSTAL PRZYWROCONY DO RUCHU'],
  ]);
  XLSX.utils.book_append_sheet(wb,ws4,'Słowniki');

  XLSX.writeFile(wb,`DT1_PD_mToilet_${yr}.xlsx`);
  toast(`✓ Plik DT1_PD_mToilet_${yr}.xlsx pobrany — ${taxable.length} pojazdów`);
}





// ==================== WYPEŁNIANIE PDF MF — ostateczna wersja ====================
// fontkit jest wbudowany w stronę jako inline script (window.fontkit dostępny globalnie)

async function loadPdfLib() {
  if (window._pdfLibLoaded) return;
  // Sprawdź czy biblioteki są już załadowane (wbudowane inline)
  if (typeof PDFLib === 'undefined') {
    throw new Error('pdf-lib nie jest dostępny — załaduj plik lokalnie');
  }
  if (typeof fontkit === 'undefined') {
    throw new Error('fontkit nie jest dostępny — załaduj plik lokalnie');
  }
  window._pdfLibLoaded = true;
}

function b64toU8(b64) {
  const s = b64.replace(/\s/g, '');
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function loadPolishFont() {
  // 1. Załadowana przez fetch() z Roboto.ttf (loadAssets)
  if (window._ROBOTO_BYTES) return window._ROBOTO_BYTES;
  // 2. Fallback CDN
  try {
    const resp = await fetch('https://fonts.gstatic.com/s/roboto/v47/KFOmCnqEu92Fr1Me5Q.ttf');
    if (!resp.ok) throw new Error('CDN HTTP ' + resp.status);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    window._ROBOTO_BYTES = bytes;
    return bytes;
  } catch(e) {
    console.warn('[PDF] Brak czcionki Roboto');
    return null;
  }
}

const WYB = {1:'Wyb\u00F3r1',2:'Wyb\u00F3r2',3:'Wyb\u00F3r3',4:'Wyb\u00F3r4',5:'Wyb\u00F3r5',6:'Wyb\u00F3r6'};
const CAT_NUMS = {D1:{b:20,e:23},D2:{b:24,e:27},D3:{b:28,e:31},D4:{b:32,e:35},D5:{b:36,e:39},D6:{b:40,e:43},D7:{b:44,e:47},D8:{b:48,e:51},D9:{b:52,e:55},D10:{b:56,e:59},D11:{b:60,e:63},D12:{b:64,e:67},D13:{b:68,e:71},D14:{b:72,e:75},D15:{b:76,e:79}};
const TYP={1:WYB[1],2:WYB[2],3:WYB[3],4:WYB[4],5:WYB[5],6:WYB[6]};
const ZAW={1:WYB[1],2:WYB[2],3:WYB[3]};

function tfp(form,name,val,fnt,sz){
  try{
    const f=form.getTextField(name);
    const txt=(val!==null&&val!==undefined)?String(val):'';
    f.setText(txt);
    if(fnt&&sz) f.setFontSize(sz);
    if(fnt) f.updateAppearances(fnt);
  }catch(e){console.warn('[PDF] brak pola tekstowego: "'+name+'"');}
}
function rgp(form,name,val){try{if(val)form.getRadioGroup(name).select(val);}catch(e){console.warn('[PDF] brak radio: "'+name+'"');}}
function cbp(form,name,on){try{on?form.getCheckBox(name).check():form.getCheckBox(name).uncheck();}catch(e){console.warn('[PDF] brak checkbox: "'+name+'"');}}
function euroSet(form,lvl,sfx){
  ['Check Box5-8','Check Box5-9','Check Box5-1','Check Box3','Check Box5-2','Check Box-6','Check Box7'].forEach((n,i)=>cbp(form,n+sfx,i===lvl));
}

async function pobierzWypelnionyPDF(){
  // Upewnij się że pliki PDF i biblioteki są załadowane
  if(!window._DT1_PDF_BYTES){
    toast('⏳ Ładowanie plików PDF...');
    try{ await loadAssets(); }
    catch(e){ toast('❌ Brak pliku DT1formularz.pdf — upewnij się że wszystkie pliki są w folderze assets/'); return; }
  }
  const selT=typeof getSelTax==='function'?getSelTax():[];
  const taxable=selT.filter(v=>v.cat);
  if(!taxable.length){toast('⚠ Zaznacz pojazdy — użyj "Zaznacz wszystkie opodatkowane"');return;}

  const btn=document.getElementById('btn-pobierz-pdf');
  const setBtn=t=>{if(btn){btn.disabled=!!t;btn.innerHTML=t||'<i class="ti ti-file-download"></i>Pobierz oryginalne PDF MF z danymi';}};
  setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Inicjalizuję...');

  try{
    // Sprawdź dostępność bibliotek
    if(typeof PDFLib==='undefined')throw new Error('pdf-lib nie załadowany — otwórz plik lokalnie (nie przez Claude)');
    if(typeof fontkit==='undefined')throw new Error('fontkit nie załadowany — otwórz plik lokalnie (nie przez Claude)');

    const {PDFDocument}=PDFLib;
    setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Ładuję czcionkę...');
    const fontBytes=await loadPolishFont();

    // Dane podatnika
    const tp=id=>(document.getElementById(id)||{}).value||'';
    const co=typeof getCurrentCompany==='function'?getCurrentCompany():{};
    const yr=(document.getElementById('taxYearDT1')||document.getElementById('taxYear')||{}).value||'2026';
    const nip=tp('tp-nip')||co.nip||'', nazwa=tp('tp-nazwa')||co.name||'';
    const organ=tp('tp-organ')||co.organ||'', woj=tp('tp-woj')||co.woj||'MAZOWIECKIE';
    const ulica=tp('tp-ulica')||co.ulica||'', dom=tp('tp-dom')||co.dom||'';
    const lokal=tp('tp-lokal')||co.lokal||'', miasto=tp('tp-miasto')||co.miasto||'';
    const kod=tp('tp-kod')||co.kod||'';
    const today=new Date().toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});

    const total=typeof totalTax==='function'?totalTax():taxable.reduce((s,v)=>s+(v.amount||0),0);
    const r1=Math.round(total/2),r2=Math.round(total)-r1;
    const cats={};
    taxable.forEach(v=>{if(!cats[v.cat])cats[v.cat]={cnt:0,amt:0};cats[v.cat].cnt++;cats[v.cat].amt+=v.amount||0;});
    const groups=[];
    for(let i=0;i<taxable.length;i+=3)groups.push(taxable.slice(i,i+3));

    console.log(`[PDF] ${taxable.length} pojazdów → ${groups.length} DT-1/A`);

    // ====== DT-1 ======
    setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Wypełniam DT-1...');
    const dt1Doc=await PDFDocument.load(window._DT1_PDF_BYTES,{ignoreEncryption:true});
    dt1Doc.registerFontkit(fontkit); // MUSI być przed embedFont
    const fnt=fontBytes?await dt1Doc.embedFont(fontBytes):null;
    const f1=dt1Doc.getForm();
    console.log('[DT-1 Fields]', f1.getFields().map(f=>f.constructor.name+': "'+f.getName()+'"').join('\n'));
    const page1 = dt1Doc.getPage(0);

    tfp(f1,'PESEL',nip,fnt,10);
    tfp(f1,'5 Nazwa i adres siedziby organu podatkowego',organ,fnt,7);
    tfp(f1,'nazwa - nazwisko',nazwa,fnt,8);
    tfp(f1,'8 Kraj','Polska',fnt,8);
    tfp(f1,'9 Województwo',woj,fnt,8);
    tfp(f1,'10 Powiat',tp('tp-powiat')||co.powiat||'',fnt,8);
    tfp(f1,'Gmina',tp('tp-gmina')||co.gmina||'',fnt,8);
    tfp(f1,'12 Ulica',ulica,fnt,8);
    tfp(f1,'13 Nr domu',dom,fnt,8);
    tfp(f1,'14 Nr lokalu',lokal||'',fnt,8);
    tfp(f1,'Miejscowość',miasto,fnt,8);
    tfp(f1,'16 Kod pocztowy',kod,fnt,8);
    tfp(f1,'Poczta',miasto,fnt,8);
    if(fnt){page1.drawText(String(yr),{x:248,y:667,size:10,font:fnt});}
    tfp(f1,'fill_15','',fnt,9); // pole 19 ma być puste
    tfp(f1,'fill_11',String(groups.length),fnt,10); // pole 83 liczba załączników
    tfp(f1,'85 Nazwisko',tp('tp-nazwisko'),fnt,8);
    tfp(f1,'Data wypełnienia',today,fnt,8);
    tfp(f1,'fill_12',tp('tp-imie'),fnt,8); // pole 84 Imię
    tfp(f1,'80',total.toFixed(2).replace('.',','),fnt,9);
    tfp(f1,'81',String(r1),fnt,9);
    tfp(f1,'82',String(r2),fnt,9);
    const rodzajPodatnika = tp('tp-rodzaj')==='fizyczny' ? 'Wybór2' : 'Wybór1';
    rgp(f1,'Group2',rodzajPodatnika);

    const celNr={
      'DEKLARACJA SKLADANA DO 15 LUTEGO':'Wybór1',
      'POWSTANIE OBOWIAZKU W TRAKCIE ROKU':'Wybór2',
      'WYGASNIECIE OBOWIAZKU W TRAKCIE ROKU':'Wybór3',
      'ZMIANA MIEJSCA ZAMIESZKANIA LUB SIEDZIBY':'Wybór5',
      'KOREKTA DEKLARACJI':'Wybór6',
      'PRZEDLUZENIE WYCOFANIA':'Wybór7'
    }[tp('tp-cel')]||'Wybór1';

    rgp(f1,'Group3',celNr);
    Object.entries(CAT_NUMS).forEach(([cat,nums])=>{const d=cats[cat];tfp(f1,String(nums.b),d?String(d.cnt):'',fnt,9);tfp(f1,String(nums.e),d?d.amt.toFixed(2).replace('.',','):'',fnt,9);});
    f1.flatten();
    const dt1Bytes=await dt1Doc.save();
    const allBytes=[dt1Bytes];

    // ====== DT-1/A ======
    const dt1aTemplate=window._DT1A_PDF_BYTES;
    const SFXS=[['',1],['2',2],['3',3]];
    for(let gi=0;gi<groups.length;gi++){
      setBtn(`<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Załącznik ${gi+1}/${groups.length}...`);
      try{
        const grp=groups[gi],attNo=gi+1;
        const doc=await PDFDocument.load(dt1aTemplate,{ignoreEncryption:true});
        doc.registerFontkit(fontkit);
        const fa=fontBytes?await doc.embedFont(fontBytes):null;
        const fm=doc.getForm();
        if(gi===0) console.log('[DT-1/A Fields]', fm.getFields().map(f=>f.constructor.name+': "'+f.getName()+'"').join('\n'));
        tfp(fm,'pesel',nip,fa,9);
        tfp(fm,'numer załącznika',String(attNo),fa,12);
        tfp(fm,'Text2',nazwa,fa,7);
        rgp(fm,'Group1',rodzajPodatnika);
        grp.forEach((v,i)=>{
          const[sfx,vnum]=SFXS[i];
          const dmc=(v.dmc||v.dmcMax)?(v.dmc||v.dmcMax)/1000:0;
          const dmcI=Math.floor(dmc).toString();
          const dmcD=Math.round((dmc%1)*100).toString().padStart(2,'0');
          const dmcZ=v.dmcZespolu>0?(v.dmcZespolu/1000).toFixed(2).replace('.',','):'';
          const kwI=Math.floor(v.amount||0).toString();
          const kwD=Math.round(((v.amount||0)%1)*100).toString().padStart(2,'0');
          const vf=`5 Numer Identyfikacyjny VIN  nadwozia podwozia lub ramy ${vnum}1`;
          tfp(fm,`4 Numer rejestracyjny pojazdu${sfx}`,v.nrRej,fa,9);
          tfp(fm,vf,v.vin,fa,7);
          tfp(fm,`6 Marka typ model pojazdu${sfx}`,`${v.marka||''} ${v.model||''}`,fa,8);
          tfp(fm,`rok produkcji${sfx}`,String(v.rok||''),fa,8);
          const dI=sfx===''?'Text3':sfx==='2'?'Text32':'Text33';
          const dD=sfx===''?'Text4':sfx==='2'?'Text42':'Text43';
          const dZ=sfx===''?'Text3-111':sfx==='2'?'Text3-122':'Text3-3';
          const dZd=sfx===''?'Text4-111':sfx==='2'?'Text4-1222':'Text4-33';
          const oF=sfx===''?'Text4-1':sfx==='2'?'Text4-12':'Text4-13';
          const kI=sfx===''?'Text6':sfx==='2'?'Text62':'Text63';
          const kD=sfx===''?'Text7':sfx==='2'?'Text72':'Text73';
          tfp(fm,dI,dmcI,fa,9);tfp(fm,dD,dmcD,fa,9);
          if(dmcZ){const dZparts=dmcZ.split(',');tfp(fm,dZ,dZparts[0],fa,9);tfp(fm,dZd,dZparts[1]||'00',fa,9);}
          tfp(fm,oF,String(v.osie||2),fa,10);
          tfp(fm,kI,kwI,fa,9);tfp(fm,kD,kwD,fa,9);
          const DF={'':  {rej:'Data rejestracji',  nab:'Dzien nabycia',  zb:'data zbycia1',wyc:'data wycofania',  dop:'data dopuszczenia',  wyr:'data wyrejestrowania'},
                    '2': {rej:'Data rejestracji22',nab:'Dzien nabycia2', zb:'data zbycia2',wyc:'data wycofania2', dop:'data dopuszczenia2', wyr:'data wyrejestrowania2'},
                    '3': {rej:'Data rejestracji3', nab:'Dzien nabycia3', zb:'data zbycia3',wyc:'data wycofania3', dop:'data dopuszczenia3', wyr:'data wyrejestrowania3'}}[sfx];
          tfp(fm,DF.rej,v.dataRejestracji||v.dataRej||'',fa,7);
          tfp(fm,DF.nab,v.dataNabycia||v.purchaseDate||'',fa,7);
          tfp(fm,DF.zb,v.dataZbycia||v.saleDate||'',fa,7);
          tfp(fm,DF.wyc,v.dataWycofania||'',fa,7);
          tfp(fm,DF.dop,v.dataDopuszczenia||'',fa,7);
          tfp(fm,DF.wyr,v.dataWyrejestrowania||'',fa,7);
          rgp(fm,sfx===''?'Group3':sfx==='2'?'Group22':'Group23',WYB[1]);
          const typStr=(v.typ||'').toLowerCase();
          const typNr=v.typ_nr||(typStr.includes('ciągnik siodłowy')||typStr.includes('ciagnik siodlowy')?2:typStr.includes('ciągnik balastowy')||typStr.includes('ciagnik balastowy')?3:typStr.includes('naczepa')?5:typStr.includes('przyczepa')?4:typStr.includes('autobus')?6:1);
          rgp(fm,sfx===''?'Group2':sfx==='2'?'Group32':'Group33',TYP[typNr]||WYB[1]);
          const zawNr=v.zawieszenie==='równoważne z pneumatycznym'||v.zawieszenie==='równoważne'?2:v.zawieszenie==='inny system zawieszenia'||v.zawieszenie==='inne'?3:1;
          rgp(fm,sfx===''?'Group4':sfx==='2'?'Group42':'Group43',ZAW[zawNr]||WYB[1]);
          const eL=v.euro_nr!=null?v.euro_nr:((v.euro||'').includes('6')?6:(v.euro||'').includes('5')?5:(v.euro||'').includes('4')?4:(v.euro||'').includes('3')?3:(v.euro||'').includes('2')?2:(v.euro||'').includes('1')?1:0);
          euroSet(fm,eL,sfx);
        });
        fm.flatten();
        allBytes.push(await doc.save());
        console.log(`[PDF] Zał. ${attNo}/${groups.length} gotowy`);
      }catch(e2){
        console.error(`[PDF] Zał. ${gi+1} błąd:`,e2.message);
        // Kontynuuj z pozostałymi załącznikami
      }
    }

    // ====== SCAL ======
    setBtn('<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Scalanie PDF...');
    const finalDoc=await PDFDocument.create();
    for(const bytes of allBytes){
      try{
        const src=await PDFDocument.load(bytes);
        const pages=await finalDoc.copyPages(src,src.getPageIndices());
        pages.forEach(p=>finalDoc.addPage(p));
      }catch(e3){console.error('[PDF] Merge error:',e3);}
    }
    const finalBytes=await finalDoc.save();
    const blob=new Blob([finalBytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    // Pobierz
    const a=document.createElement('a');a.href=url;
    a.download=`DT-1_${nip.replace(/\D/g,'')}_${yr}.pdf`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    // Podgląd PDF w iframe
    const previewEl=document.getElementById('forms-container');
    if(previewEl){
      if(window._lastPdfUrl) URL.revokeObjectURL(window._lastPdfUrl);
      window._lastPdfUrl=url;
      previewEl.innerHTML='<p style="text-align:center;font-size:12px;color:#666;margin:8px">Podgląd wygenerowanego PDF — przewiń aby zobaczyć wszystkie strony</p>'
        +'<iframe src="'+url+'#view=FitH" style="width:100%;height:1100px;border:1px solid #ddd;border-radius:4px"></iframe>';
    } else {
      URL.revokeObjectURL(url);
    }
    toast(`✅ Pobrano: DT-1 + ${allBytes.length-1} × DT-1/A | ${taxable.length} pojazdów | polskie znaki ✓`);

  }catch(err){
    console.error('[PDF]',err);
    toast('❌ ' + err.message);
  }finally{setBtn(null);}
}



async function generujDt1Multi() {
  if (typeof DT1Generator === 'undefined') {
    toast('⚠ Moduł DT1Generator niedostępny — sprawdź czy dt1-generator.js jest załadowany');
    return;
  }
  // Wszystkie pojazdy floty z kategorią DT-1 (nie tylko zaznaczone)
  const allTaxable = (window.vehs || []).map(v => ({ ...v, ...calcTax(v) })).filter(v => v.cat);
  if (!allTaxable.length) {
    toast('⚠ Brak pojazdów opodatkowanych w flocie — uzupełnij kategorie DT-1 w kalkulatorze');
    return;
  }

  const tp = id => (document.getElementById(id) || {}).value || '';
  const co = typeof getCurrentCompany === 'function' ? getCurrentCompany() : {};
  const yr = tp('taxYearDT1') || String(new Date().getFullYear());

  const taxpayerData = {
    nip:    tp('tp-nip')      || co.nip      || '',
    nazwa:  tp('tp-nazwa')    || co.name      || '',
    organ:  tp('tp-organ')    || co.organ     || '',
    ulica:  tp('tp-ulica')    || co.street    || '',
    dom:    tp('tp-dom')      || co.building  || '',
    lokal:  tp('tp-lokal')    || co.flat      || '',
    kod:    tp('tp-kod')      || co.postalCode|| '',
    miasto: tp('tp-miasto')   || co.city      || '',
    woj:    tp('tp-woj')      || co.woj       || '',
    imie:   tp('tp-imie')     || '',
    nazwisko: tp('tp-nazwisko')|| '',
    cel:    tp('tp-cel')      || 'DEKLARACJA SKLADANA DO 15 LUTEGO',
    rodzajPodatnika: tp('tp-rodzaj') || 'niefizyczny',
  };

  toast(`⏳ Generuję DT-1 dla ${allTaxable.length} pojazdów...`);
  try {
    await DT1Generator.generate(taxpayerData, allTaxable, { rok: parseInt(yr) });

    // Zapisz do archiwum deklaracji
    if (window.Dt1Declarations?.saveDeclaration) {
      const totalTax = allTaxable.reduce((s, v) => {
        const t = typeof calcTax === 'function' ? calcTax(v) : {};
        return s + (t.amount || v.amount || 0);
      }, 0);
      await window.Dt1Declarations.saveDeclaration({
        rok:           parseInt(yr),
        total_tax:     Math.round(totalTax * 100) / 100,
        vehicle_count: allTaxable.length,
        gmina:         document.getElementById('vd-gmina')?.value || taxpayerData.gmina || 'brak',
        vehicles:      allTaxable.map(v => {
          const t = typeof calcTax === 'function' ? calcTax(v) : {};
          return { nrRej: v.nrRej, marka: v.marka, model: v.model, cat: t.cat||v.cat, miesiacePodatku: v.miesiacePodatku ?? 12, amount: t.amount||v.amount||0 };
        }),
      });
    }
  } catch(e) {
    toast('❌ ' + e.message);
    console.error('[DT1Multi]', e);
  }
}

function printFormularze() {
  renderFormularze();
  setTimeout(() => window.print(), 500);
}


// Synchronizuj rok i przyczynę między zakładkami
function syncTaxYear() {
  const main = document.getElementById('taxYear');
  const alt  = document.getElementById('taxYearPodatnik');
  if (main && alt) alt.value = main.value;
}
function syncTpCel() {
  const main = document.getElementById('tp-cel');
  const alt  = document.getElementById('tp-celPodatnik');
  if (main && alt) alt.value = main.value;
}

// ==================== TOAST ====================
// Auto-translates common Polish prefixes when a non-PL language is active.
// Dynamic suffixes (plate numbers, counts, etc.) are preserved as-is.
function toast(msg) {
  if (window.I18n && window.I18n.getLang() !== 'pl') {
    msg = msg
      .replace(/^✓ Zapisano(\b|$)/,     window.t('toast.saved') + ' ')
      .replace(/^✓ Usunięto(\b|$)/,     window.t('toast.deleted') + ' ')
      .replace(/^❌ Błąd(\b|$)/,         window.t('toast.error') + ' ')
      .replace(/^✅ Import zakończony/,   window.t('toast.import.ok'))
      .replace(/^✓ Backup zapisany/,     window.t('toast.backup.ok'))
      .replace(/^⚠ Nie zaznaczono/,      window.t('toast.no.sel'))
      .trim();
  }
  const el = document.getElementById('toast');
  el.innerHTML = `<i class="ti ti-check"></i> ${esc(msg)}`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ==================== WALIDACJA ====================
function runValidation() {
  const selT = getSelTax();
  const errors = [], warnings = [], infos = [];
  const nip = tp('tp-nip');

  // --- BŁĘDY KRYTYCZNE ---
  // 1. NIP
  if(!/^\d{10}$/.test(nip.replace(/[-\s]/g,''))) {
    errors.push({code:'NIP-001',title:'Nieprawidłowy NIP podatnika',desc:`NIP "${nip}" nie spełnia wymagań (10 cyfr). Popraw w zakładce Podatnik.`,link:'podatnik',icon:'ti-id'});
  }
  // 2. Brak pojazdów
  if(selT.length===0) {
    errors.push({code:'DT1-001',title:'Brak zaznaczonych pojazdów',desc:'Nie zaznaczono żadnych pojazdów do deklaracji. Przejdź do zakładki Pojazdy.',link:'pojazdy',icon:'ti-truck'});
  }
  // 3. Pojazdy bez kategorii
  const brakKat = selT.filter(v=>!v.cat);
  brakKat.forEach(v=>{
    errors.push({code:'KAT-001',veh:v.nrRej,title:`${v.nrRej} — brak kategorii DT-1`,desc:`Pojazd ${v.marka} ${v.model} (DMC: ${((v.dmc||v.dmcMax||0)/1000).toFixed(1)} t) nie ma przypisanej kategorii D.1–D.15. Sprawdź typ pojazdu i DMC.`,link:'pojazdy',icon:'ti-alert-circle'});
  });
  // 4. Przyczepa/naczepa bez DMC zespołu
  selT.forEach(v=>{
    const isTrailer=(v.typ||'').toLowerCase().includes('przy')||(v.typ||'').toLowerCase().includes('nacz');
    if(isTrailer && !v.dmcZespolu) {
      errors.push({code:'DMC-001',veh:v.nrRej,title:`${v.nrRej} — brak DMC zespołu pojazdów`,desc:`Przyczepa/naczepa ${v.marka} ${v.model} wymaga podania DMC zespołu (przyczepa + pojazd ciągnący) do prawidłowej kategoryzacji i wyliczenia podatku.`,link:'pojazdy',icon:'ti-scale'});
    }
  });
  // 5. Suma deklaracji = 0 przy zaznaczonych pojazdach
  const total = totalTax();
  if(selT.length>0 && total===0) {
    errors.push({code:'SUM-001',title:'Łączny podatek wynosi 0 zł',desc:'Suma podatku z poz. 80 wynosi 0 zł przy zaznaczonych pojazdach. Sprawdź czy kategorie są poprawnie przypisane.',link:'kalkulator',icon:'ti-cash'});
  }
  // 6. Niezgodność liczby załączników
  const taxable = selT.filter(v=>v.cat);
  const attCalc = Math.ceil(taxable.length/3);
  if(taxable.length>0 && attCalc===0) {
    errors.push({code:'ATT-001',title:'Błędna liczba załączników DT-1/A',desc:'Liczba załączników DT-1/A wynosi 0 mimo istnienia pojazdów z kategorią. Odśwież kalkulator.',link:'kalkulator',icon:'ti-paperclip'});
  }

  // --- OSTRZEŻENIA ---
  // 7. Pojazdy ≥12t bez prawidłowej liczby osi
  selT.forEach(v=>{
    if((v.dmc||v.dmcMax||0)>=12000 && (!v.osie||v.osie<2)) {
      warnings.push({code:'OSI-001',veh:v.nrRej,title:`${v.nrRej} — sprawdź liczbę osi`,desc:`Pojazd o DMC ≥12 t (${((v.dmc||v.dmcMax||0)/1000).toFixed(1)} t) powinien mieć co najmniej 2 osie. Aktualnie: ${v.osie}. Liczba osi wpływa na stawkę podatkową.`,link:'pojazdy',icon:'ti-settings'});
    }
  });
  // 8. VIN pusty lub za krótki
  selT.forEach(v=>{
    if(!v.vin || v.vin.trim().length<5) {
      warnings.push({code:'VIN-001',veh:v.nrRej,title:`${v.nrRej} — brakujący lub nieprawidłowy VIN`,desc:`Pojazd ${v.marka} ${v.model} ma pusty lub za krótki numer VIN (min. 17 znaków dla nowych pojazdów). VIN jest wymagany w formularzu DT-1/A.`,link:'pojazdy',icon:'ti-fingerprint'});
    }
  });
  // 9. Pojazd 2024+ bez §2
  selT.forEach(v=>{
    if((parseInt(v.rok)||0)>=2024 && v.cat && v.rate) {
      const expectedNew = {D1:744,D2:1008,D3:1344,D4:1248,D5:1128};
      const expectedOld = {D1:840,D2:1128,D3:1488,D4:1392,D5:1248};
      if(expectedOld[v.cat] && v.rate===expectedOld[v.cat]) {
        warnings.push({code:'PAR-002',veh:v.nrRej,title:`${v.nrRej} — możliwa obniżona stawka §2`,desc:`Pojazd z roku ${v.rok} może kwalifikować się do stawki §2 (obniżonej dla pojazdów rok ≥ 2024). Aktualna stawka: ${v.rate} zł. Stawka §2: ${expectedNew[v.cat]} zł. Zweryfikuj z uchwałą.`,link:'stawki',icon:'ti-discount'});
      }
    }
  });
  // 10. Marka/model nieznana (tylko 2-3 litery nr rej)
  selT.forEach(v=>{
    if((v.nrRej||'').length<=3 && !v.rok) {
      warnings.push({code:'DAT-001',veh:v.nrRej,title:`${v.nrRej} — niekompletne dane pojazdu`,desc:`Pojazd ma niepełny numer rejestracyjny lub brakuje roku produkcji. Sprawdź dane w dowodzie rejestracyjnym.`,link:'pojazdy',icon:'ti-file-description'});
    }
  });
  // 11. Podatek = 0 dla pojazdu z kategorią
  selT.forEach(v=>{
    if(v.cat && v.amount===0) {
      warnings.push({code:'TAX-001',veh:v.nrRej,title:`${v.nrRej} — podatek 0 zł mimo kategorii ${v.cat}`,desc:`Pojazd ma przypisaną kategorię ${v.cat}, ale wyliczony podatek wynosi 0 zł. Sprawdź liczbę miesięcy i stawkę.`,link:'pojazdy',icon:'ti-coin'});
    }
  });
  // 12. Pojazd wynajęty w deklaracji
  selT.forEach(v=>{
    if(v.status==='Wynajęty') {
      warnings.push({code:'WYN-001',veh:v.nrRej,title:`${v.nrRej} — pojazd WYNAJĘTY w deklaracji`,desc:`Pojazd ${v.marka} ${v.model} (właściciel: ${v.wlasciciel}) ma status Wynajęty. Obowiązek podatkowy ciąży na właścicielu/leasingodawcy — zweryfikuj czy mToilet jest podatnikiem dla tego pojazdu.`,link:'pojazdy',icon:'ti-contract'});
    }
  });

  // --- INFORMACJE ---
  // 13. Brak danych podatnika
  if(!tp('tp-imie')||!tp('tp-nazwisko')) {
    infos.push({code:'POD-001',title:'Brak danych osoby podpisującej',desc:'Nie uzupełniono imienia i/lub nazwiska osoby podpisującej deklarację (poz. 84–85 DT-1). Uzupełnij w zakładce Podatnik.',link:'podatnik',icon:'ti-user'});
  }
  // 14. Duże pojazdy ciężarowe ≥12t
  const heavyNoAxle = selT.filter(v=>(v.dmc||v.dmcMax||0)>=12000&&v.osie>=4&&v.cat);
  if(heavyNoAxle.length>0) {
    infos.push({code:'OSI-002',title:`${heavyNoAxle.length} pojazd(ów) ≥12 t z 4+ osiami`,desc:`Pojazdy z 4 i więcej osiami mają najwyższe stawki w kategorii D.10. Sprawdź czy liczba osi jest prawidłowa w dowodzie rejestracyjnym.`,link:'pojazdy',icon:'ti-info-circle'});
  }
  // 15. Podwójna kategoryzacja
  const nrRejList = selT.map(v=>v.nrRej);
  const dupes = nrRejList.filter((v,i)=>nrRejList.indexOf(v)!==i);
  if(dupes.length>0) {
    infos.push({code:'DUP-001',title:`Zduplikowane pojazdy: ${dupes.join(', ')}`,desc:'Te same numery rejestracyjne pojawiają się więcej niż raz w bazie danych. Sprawdź i usuń duplikaty.',link:'pojazdy',icon:'ti-copy'});
  }

  // --- UBEZPIECZENIA I BADANIA TECHNICZNE (cała flota) ---
  const allFleet = vehs.filter(v => v.is_active !== false);
  const _daysDiff = dateStr => { if(!dateStr) return null; const d=new Date(dateStr.includes('T')?dateStr:dateStr+'T00:00:00'); if(isNaN(d)) return null; const t=new Date(); t.setHours(0,0,0,0); return Math.round((d-t)/86400000); };
  allFleet.forEach(v => {
    const checks = [
      { label:'OC', date: v.ocEnd,           code: 'OC' },
      { label:'AC', date: v.acEnd,           code: 'AC' },
      { label:'Przegląd tech.', date: v.nextInspection, code: 'PRZE' },
      ...(v.hasUdt && v.udtNextDate   ? [{ label:'Badanie UDT',      date: v.udtNextDate,    code:'UDT' }] : []),
      ...(v.hasTacho && v.tachoNextCalib ? [{ label:'Legalizacja tacho', date: v.tachoNextCalib, code:'TACH' }] : []),
    ];
    checks.forEach(({ label, date, code }) => {
      const days = _daysDiff(date);
      if (days === null) {
        if (code === 'OC') infos.push({code:`${code}-BRAK-${v.nrRej}`,veh:v.nrRej,title:`${v.nrRej} — brak daty ${label}`,desc:`Pojazd ${v.marka} ${v.model} nie ma uzupełnionej daty końca ${label}. Uzupełnij w karcie pojazdu.`,link:'pojazdy',icon:'ti-shield-off'});
        return;
      }
      if (days < 0) {
        errors.push({code:`${code}-EXP-${v.nrRej}`,veh:v.nrRej,title:`${v.nrRej} — ${label} WYGASŁO ${Math.abs(days)} dni temu`,desc:`Pojazd ${v.marka} ${v.model}: ${label} wygasło ${new Date(date).toLocaleDateString('pl-PL')}. Wymaga natychmiastowego uregulowania.`,link:'pojazdy',icon:'ti-shield-x'});
      } else if (days <= 14) {
        warnings.push({code:`${code}-SOON-${v.nrRej}`,veh:v.nrRej,title:`${v.nrRej} — ${label} wygasa za ${days} dni`,desc:`Pojazd ${v.marka} ${v.model}: ${label} wygasa ${new Date(date).toLocaleDateString('pl-PL')}. Odnów ubezpieczenie/badanie.`,link:'pojazdy',icon:'ti-alert-triangle'});
      } else if (days <= 30) {
        infos.push({code:`${code}-NEAR-${v.nrRej}`,veh:v.nrRej,title:`${v.nrRej} — ${label} wygasa za ${days} dni`,desc:`Pojazd ${v.marka} ${v.model}: ${label} wygasa ${new Date(date).toLocaleDateString('pl-PL')}.`,link:'pojazdy',icon:'ti-calendar'});
      }
    });
  });

  // Aktualizuj badge
  const totalIssues = errors.length+warnings.length;
  document.getElementById('badge-err').textContent = totalIssues;
  document.getElementById('badge-err').style.background = errors.length>0?'var(--red)':warnings.length>0?'var(--amber)':'var(--green)';

  // Aktualizuj liczniki
  document.getElementById('val-progress').classList.remove('hidden');
  document.getElementById('val-cnt-err').textContent = errors.length;
  document.getElementById('val-cnt-warn').textContent = warnings.length;
  document.getElementById('val-cnt-info').textContent = infos.length;
  const okCount = selT.filter(v=>!errors.find(e=>e.veh===v.nrRej)&&!warnings.find(w=>w.veh===v.nrRej)).length;
  document.getElementById('val-cnt-ok').textContent = okCount;

  const summary = document.getElementById('val-summary');
  if(errors.length===0&&warnings.length===0) {
    summary.innerHTML = '<span style="color:var(--green);font-weight:500"><i class="ti ti-circle-check"></i> Deklaracja gotowa do złożenia — brak błędów!</span>';
  } else {
    summary.innerHTML = `<span style="color:var(--red)">${errors.length} błąd(ów) krytycznych</span> · <span style="color:var(--amber)">${warnings.length} ostrzeżeń</span> · <span style="color:var(--blue)">${infos.length} informacji</span>`;
  }

  const renderIssue = (issue, type) => {
    const colors = {err:{bg:'var(--red-light)',border:'#F09595',text:'#791F1F',icon:'ti-alert-circle',label:'BŁĄD KRYTYCZNY'},warn:{bg:'var(--amber-light)',border:'#EF9F27',text:'#633806',icon:'ti-alert-triangle',label:'OSTRZEŻENIE'},info:{bg:'var(--blue-light)',border:'#B5D4F4',text:'var(--blue-dark)',icon:'ti-info-circle',label:'INFORMACJA'}};
    const c = colors[type];
    return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:var(--radius-lg);padding:14px 16px;margin-bottom:10px;display:flex;gap:12px;align-items:flex-start">
      <i class="ti ${issue.icon||c.icon}" style="font-size:20px;color:${c.text};flex-shrink:0;margin-top:1px"></i>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:${c.text};color:#fff">${c.label}</span>
          <span style="font-size:10px;color:${c.text};font-family:var(--mono)">${esc(issue.code)}</span>
          ${issue.veh?`<span style="font-family:var(--mono);font-size:11px;font-weight:600;color:${c.text}">${esc(issue.veh)}</span>`:''}
        </div>
        <div style="font-weight:600;font-size:13px;color:${c.text};margin-bottom:3px">${esc(issue.title)}</div>
        <div style="font-size:12px;color:${c.text};opacity:.85;line-height:1.5">${esc(issue.desc)}</div>
      </div>
      ${issue.link?`<button class="btn btn-gray" style="flex-shrink:0;font-size:11px" onclick="showPage('${issue.link}')"><i class="ti ti-arrow-right"></i>Przejdź</button>`:''}
    </div>`;
  };

  let html = '';
  if(errors.length===0&&warnings.length===0&&infos.length===0) {
    html = `<div class="gbox"><i class="ti ti-circle-check" style="font-size:24px"></i><div><strong>Deklaracja poprawna!</strong><br>Wszystkie sprawdzane reguły spełnione. Możesz przejść do zakładki DT-1/A i wydrukować formularze.</div></div>`;
  } else {
    if(errors.length>0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-circle"></i>Błędy krytyczne — wymagają poprawy przed złożeniem deklaracji</div>`;
      html += errors.map(e=>renderIssue(e,'err')).join('');
    }
    if(warnings.length>0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--amber);margin:16px 0 10px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-triangle"></i>Ostrzeżenia — zalecana weryfikacja</div>`;
      html += warnings.map(w=>renderIssue(w,'warn')).join('');
    }
    if(infos.length>0) {
      html += `<div style="font-size:13px;font-weight:600;color:var(--blue);margin:16px 0 10px;display:flex;align-items:center;gap:6px"><i class="ti ti-info-circle"></i>Informacje</div>`;
      html += infos.map(i=>renderIssue(i,'info')).join('');
    }
  }
  document.getElementById('val-results').innerHTML = html;
  toast(`✓ Walidacja zakończona — ${errors.length} błędów, ${warnings.length} ostrzeżeń`);
}

// ==================== RAPORTY ====================
function getRpVehs() {
  const fWl = document.getElementById('rp-wl')?.value||'';
  const fStat = document.getElementById('rp-status')?.value||'';
  return vehs.filter(v=>(!fWl||v.wlasciciel===fWl)&&(!fStat||v.status===fStat));
}

function renderRaporty() {
  const list = getRpVehs();
  const grouped = document.getElementById('rp-group')?.value||'marka';
  const taxes = list.map(v=>({...v,...calcTax(v)}));
  const total = taxes.reduce((s,v)=>s+(v.amount||0),0);
  const taxable = taxes.filter(v=>v.cat);
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const newCount = taxes.filter(v=>(parseInt(v.rok)||0)>=2024&&v.cat).length;
  const newTax = taxes.filter(v=>(parseInt(v.rok)||0)>=2024&&v.cat).reduce((s,v)=>s+(v.amount||0),0);
  const oldTax = total - newTax;

  // KPI
  document.getElementById('rp-kpi').innerHTML = [
    ['Pojazdy w analizie',list.length,'','var(--text)'],
    ['Podatek roczny razem',fmt2(total)+' zł','poz. 80 DT-1','var(--green)'],
    ['I rata (15.02)',fmtZl(r1)+' zł','do zapłaty','var(--blue)'],
    ['II rata (15.09)',fmtZl(r2)+' zł','do zapłaty','var(--blue)'],
    ['Pojazdy §2 (2024+)',newCount+' poj.','obniżona stawka','var(--amber)'],
  ].map(([l,v,s,c])=>`<div class="stat"><div class="stat-label">${l}</div><div class="stat-val" style="color:${c};font-size:22px">${v}</div><div class="stat-sub">${s}</div></div>`).join('');

  // Grupowanie
  const groups = {};
  const groupLabel = {marka:'marka',cat:'kategorię DT-1',status:'status własności',rok:'rok produkcji'};
  document.getElementById('rp-chart-title').textContent = `Podatek roczny wg ${groupLabel[grouped]||'marki'}`;

  taxes.filter(v=>v.cat).forEach(v=>{
    const key = grouped==='cat'?v.cat:grouped==='rok'?Math.floor((parseInt(v.rok)||0)/5)*5+'–'+(Math.floor((parseInt(v.rok)||0)/5)*5+4):v[grouped]||'Inne';
    if(!groups[key])groups[key]={count:0,tax:0,veh:[]};
    groups[key].count++;groups[key].tax+=v.amount;groups[key].veh.push(v.nrRej);
  });
  const maxTax = Math.max(...Object.values(groups).map(g=>g.tax),1);

  // Wykres słupkowy — Chart.js (fallback: HTML bars)
  const CHART_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
  const isDark = document.documentElement.classList.contains('dark');
  const _tc = isDark ? '#9ca3af' : '#6b7280';
  const _gc = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
  const sortedGroups = Object.entries(groups).sort((a,b)=>b[1].tax-a[1].tax);
  if (!window._rpCharts) window._rpCharts = {};
  const barEl = document.getElementById('rp-chart');
  if (window.Chart) {
    barEl.innerHTML = '<div style="position:relative;height:260px"><canvas id="rp-bar-canvas"></canvas></div>';
    if (window._rpCharts.bar) { window._rpCharts.bar.destroy(); window._rpCharts.bar = null; }
    if (sortedGroups.length) {
      window._rpCharts.bar = new Chart(document.getElementById('rp-bar-canvas'), {
        type: 'bar',
        data: {
          labels: sortedGroups.map(([k])=>k),
          datasets: [{ data: sortedGroups.map(([,g])=>g.tax), backgroundColor: sortedGroups.map((_,i)=>CHART_COLORS[i%CHART_COLORS.length]), borderRadius: 4, borderSkipped: false }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '  ' + fmt2(ctx.raw) + ' zł · ' + (sortedGroups[ctx.dataIndex]?.[1]?.count||0) + ' poj.' } } },
          scales: {
            x: { ticks: { color: _tc, callback: v => fmtZl(v) + ' zł', font: { size: 10 } }, grid: { color: _gc } },
            y: { ticks: { color: _tc, font: { size: 11 } }, grid: { display: false } }
          }
        }
      });
    } else {
      barEl.innerHTML = '<div style="color:var(--text3);text-align:center;padding:2rem">Brak danych podatkowych</div>';
    }
  } else {
    barEl.innerHTML = sortedGroups.map(([k,g],i)=>{
      const pct = Math.round(g.tax/maxTax*100);
      const col = CHART_COLORS[i%CHART_COLORS.length];
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:110px;font-size:12px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text2)">${k}</div>
        <div style="flex:1;background:var(--bg3);border-radius:4px;overflow:hidden;height:22px">
          <div style="width:${pct}%;background:${col};height:100%;border-radius:4px;display:flex;align-items:center;padding-left:8px;transition:width .4s">
            <span style="font-size:10px;color:#fff;white-space:nowrap;font-weight:600">${pct>15?fmt2(g.tax)+' zł':''}</span>
          </div>
        </div>
        <div style="width:85px;font-size:11px;font-family:var(--mono);text-align:right;color:${col};font-weight:600">${fmt2(g.tax)} zł</div>
        <div style="width:30px;font-size:11px;color:var(--text3);text-align:right">${g.count}</div>
      </div>`;
    }).join('') || '<div style="color:var(--text3);text-align:center;padding:1rem">Brak danych</div>';
  }

  // §1 vs §2 — Chart.js doughnut + statystyki (fallback: SVG)
  const p1 = total>0?Math.round(oldTax/total*100):0;
  const p2 = 100-p1;
  const oldCount = taxable.length-newCount;
  const pieEl = document.getElementById('rp-pie');
  if (window.Chart) {
    pieEl.innerHTML = `
      <div style="position:relative;height:180px"><canvas id="rp-pie-canvas"></canvas></div>
      <div style="display:flex;flex-direction:column;gap:7px;margin-top:12px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:12px;height:12px;border-radius:2px;background:#3b82f6;flex-shrink:0"></div>
          <div style="font-size:12px">§1 standardowa — ${oldCount} poj. · <strong>${fmt2(oldTax)} zł</strong> (${p1}%)</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:12px;height:12px;border-radius:2px;background:#f59e0b;flex-shrink:0"></div>
          <div style="font-size:12px">§2 obniżona 2024+ — ${newCount} poj. · <strong>${fmt2(newTax)} zł</strong> (${p2}%)</div>
        </div>
        <div style="padding:8px 12px;background:var(--green-light);border-radius:var(--radius);border:1px solid #a3c97a;margin-top:4px">
          <div style="font-size:11px;color:var(--green);font-weight:600">Oszczędność dzięki §2</div>
          <div style="font-size:15px;font-weight:700;color:var(--green)">${fmt2(newCount*((840-744)+(1128-1008))/2)} zł est.</div>
        </div>
      </div>`;
    if (window._rpCharts.pie) { window._rpCharts.pie.destroy(); window._rpCharts.pie = null; }
    window._rpCharts.pie = new Chart(document.getElementById('rp-pie-canvas'), {
      type: 'doughnut',
      data: {
        labels: ['§1 standardowa', '§2 obniżona (2024+)'],
        datasets: [{ data: [oldTax||0.01, newTax||0.01], backgroundColor: ['#3b82f6','#f59e0b'], borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => '  ' + ctx.label + ': ' + fmt2(ctx.raw) + ' zł' } }
        },
        cutout: '65%'
      }
    });
  } else {
    pieEl.innerHTML = `
      <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap">
        <div style="position:relative;width:120px;height:120px;flex-shrink:0">
          <svg viewBox="0 0 36 36" style="width:120px;height:120px;transform:rotate(-90deg)">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg3)" stroke-width="3.2"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--blue)" stroke-width="3.2"
              stroke-dasharray="${p1} ${100-p1}" stroke-dashoffset="0"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--amber)" stroke-width="3.2"
              stroke-dasharray="${p2} ${100-p2}" stroke-dashoffset="${-p1}"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${p1}%</div>
        </div>
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:14px;height:14px;border-radius:3px;background:var(--blue);flex-shrink:0"></div>
            <div>
              <div style="font-weight:600;font-size:13px">§1 — stawka standardowa</div>
              <div style="font-size:12px;color:var(--text2)">${oldCount} pojazdów · ${fmt2(oldTax)} zł (${p1}%)</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div style="width:14px;height:14px;border-radius:3px;background:var(--amber);flex-shrink:0"></div>
            <div>
              <div style="font-weight:600;font-size:13px">§2 — stawka obniżona (rok ≥ 2024)</div>
              <div style="font-size:12px;color:var(--text2)">${newCount} pojazdów · ${fmt2(newTax)} zł (${p2}%)</div>
            </div>
          </div>
          <div style="padding:10px;background:var(--green-light);border-radius:var(--radius);border:1px solid #a3c97a">
            <div style="font-size:11px;color:var(--green);font-weight:600">Oszczędność dzięki §2</div>
            <div style="font-size:16px;font-weight:700;color:var(--green)">${fmt2(newCount*((840-744)+(1128-1008))/2)} zł est.</div>
            <div style="font-size:10px;color:var(--green)">szacunkowe (śr. różnica stawek)</div>
          </div>
        </div>
      </div>`;
  }

  // Harmonogram
  const months = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
  document.getElementById('rp-harmonogram').innerHTML = `<table>
    <thead><tr>
      ${months.map((m,i)=>`<th style="text-align:center;${i===1||i===8?'background:var(--blue-light);color:var(--blue)':''}">${m} 2026</th>`).join('')}
    </tr></thead>
    <tbody><tr>
      ${months.map((m,i)=>{
        if(i===1) return `<td style="text-align:center;font-weight:700;color:var(--blue);background:var(--blue-light)" title="Termin złożenia DT-1 i wpłaty I raty">${fmtZl(r1)} zł<div style="font-size:9px">I rata + DT-1</div></td>`;
        if(i===8) return `<td style="text-align:center;font-weight:700;color:var(--blue);background:var(--blue-light)" title="Termin wpłaty II raty">${fmtZl(r2)} zł<div style="font-size:9px">II rata</div></td>`;
        return `<td style="text-align:center;color:var(--text3)">—</td>`;
      }).join('')}
    </tr></tbody>
  </table>`;

  // Tabela szczegółowa
  const sorted = taxes.slice().sort((a,b)=>(b.amount||0)-(a.amount||0));
  document.getElementById('rp-table').innerHTML = `<table>
    <thead><tr>
      <th>Nr rej.</th><th>Marka / Model</th><th>Rok</th><th>Typ</th>
      <th>DMC (kg)</th><th>Status</th><th>Właściciel</th>
      <th>Kat. DT-1</th><th style="text-align:right">Stawka roczna</th>
      <th style="text-align:right">Podatek</th><th style="text-align:right">I rata</th><th style="text-align:right">II rata</th>
    </tr></thead>
    <tbody>${sorted.map(v=>{
      const r1v=Math.round((v.amount||0)/2), r2v=Math.round(v.amount||0)-r1v;
      const isNew=(parseInt(v.rok)||0)>=2024;
      return `<tr>
        <td><strong style="font-family:var(--mono)">${esc(v.nrRej)}</strong></td>
        <td>${esc(v.marka)} ${esc(v.model)} ${isNew?'<span class="pill pill-new" style="font-size:9px">§2</span>':''}</td>
        <td>${v.rok||'—'}</td>
        <td><span class="pill pill-gray" style="font-size:10px">${esc(v.typ)}</span></td>
        <td style="font-family:var(--mono);font-size:12px">${(v.dmc||v.dmcMax||0).toLocaleString('pl-PL')}</td>
        <td><span class="pill ${STAT_LABELS[v.status]||'pill-gray'}">${esc(v.status)}</span></td>
        <td style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${esc(v.wlasciciel||'—')}</td>
        <td>${v.cat?`<span class="pill ${CAT_COLORS[v.cat]||'pill-gray'}">${esc(v.cat)}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--text2)">${v.rate?v.rate.toLocaleString('pl-PL')+' zł':'—'}</td>
        <td style="text-align:right;font-family:var(--mono);font-weight:600;color:${v.amount>0?'var(--green)':'var(--text3)'}">${v.amount>0?fmt2(v.amount)+' zł':'—'}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--blue)">${v.amount>0?fmtZl(r1v)+' zł':'—'}</td>
        <td style="text-align:right;font-family:var(--mono);font-size:12px;color:var(--blue)">${v.amount>0?fmtZl(r2v)+' zł':'—'}</td>
      </tr>`;}).join('')}
    </tbody>
    <tfoot><tr>
      <td colspan="9" style="font-weight:600;text-align:right;padding:10px 16px">RAZEM:</td>
      <td style="font-weight:700;text-align:right;font-family:var(--mono);color:var(--green);padding:10px 16px">${fmt2(total)} zł</td>
      <td style="font-weight:700;text-align:right;font-family:var(--mono);color:var(--blue);padding:10px 16px">${fmtZl(r1)} zł</td>
      <td style="font-weight:700;text-align:right;font-family:var(--mono);color:var(--blue);padding:10px 16px">${fmtZl(r2)} zł</td>
    </tr></tfoot>
  </table>`;
}

function exportRaport() {
  const list = getRpVehs();
  const taxes = list.map(v=>({...v,...calcTax(v)}));
  const wb = XLSX.utils.book_new();

  // Arkusz 1: Zestawienie główne
  const hdrs=['Nr rej.','Marka','Model','Rok','Typ','DMC (kg)','Status','Właściciel','VIN','Kategoria DT-1','Stawka roczna (zł)','Miesiące','Podatek (zł)','I rata (zł)','II rata (zł)','§2 (tak/nie)'];
  const rows = taxes.map(v=>{
    const r1v=Math.round((v.amount||0)/2), r2v=Math.round(v.amount||0)-r1v;
    return [v.nrRej,v.marka,v.model,v.rok,v.typ,v.dmc||v.dmcMax||0,v.status,v.wlasciciel,v.vin||'',v.cat||'brak',v.rate||0,v.miesiacePodatku||12,Math.round(v.amount*100)/100,r1v,r2v,(parseInt(v.rok)||0)>=2024?'TAK':'NIE'];
  });
  const ws1 = XLSX.utils.aoa_to_sheet([hdrs,...rows]);
  ws1['!cols'] = hdrs.map((_,i)=>({wch:i===1||i===7?18:i===3?6:12}));
  XLSX.utils.book_append_sheet(wb,ws1,'Zestawienie pojazdów');

  // Arkusz 2: Podsumowanie wg marki
  const brands = {};
  taxes.filter(v=>v.cat).forEach(v=>{if(!brands[v.marka])brands[v.marka]={count:0,tax:0};brands[v.marka].count++;brands[v.marka].tax+=v.amount;});
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Marka','Liczba pojazdów','Podatek roczny (zł)','I rata (zł)','II rata (zł)'],
    ...Object.entries(brands).sort((a,b)=>b[1].tax-a[1].tax).map(([m,d])=>[m,d.count,Math.round(d.tax*100)/100,Math.round(d.tax/2),Math.round(d.tax)-Math.round(d.tax/2)])
  ]);
  XLSX.utils.book_append_sheet(wb,ws2,'Wg marki');

  // Arkusz 3: Wg kategorii DT-1
  const cats2 = {};
  taxes.filter(v=>v.cat).forEach(v=>{if(!cats2[v.cat])cats2[v.cat]={count:0,tax:0,label:CAT_LABELS[v.cat]||''};cats2[v.cat].count++;cats2[v.cat].tax+=v.amount;});
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Kategoria DT-1','Opis','Liczba pojazdów','Podatek roczny (zł)','I rata (zł)','II rata (zł)'],
    ...Object.entries(cats2).sort((a,b)=>b[1].tax-a[1].tax).map(([c,d])=>[c,d.label,d.count,Math.round(d.tax*100)/100,Math.round(d.tax/2),Math.round(d.tax)-Math.round(d.tax/2)])
  ]);
  XLSX.utils.book_append_sheet(wb,ws3,'Wg kategorii DT-1');

  // Arkusz 4: Harmonogram
  const yr = document.getElementById('taxYear').value;
  const total = taxes.reduce((s,v)=>s+(v.amount||0),0);
  const r1 = Math.round(total/2), r2 = Math.round(total)-r1;
  const ws4 = XLSX.utils.aoa_to_sheet([
    ['Termin','Kwota (zł)','Opis'],
    [`15.02.${yr}`,r1,'I rata podatku od środków transportowych (poz. 81 DT-1)'],
    [`15.09.${yr}`,r2,'II rata podatku od środków transportowych (poz. 82 DT-1)'],
    ['RAZEM',total,'Łączna kwota podatku za rok '+yr+' (poz. 80 DT-1)'],
  ]);
  XLSX.utils.book_append_sheet(wb,ws4,'Harmonogram płatności');

  const yr2 = document.getElementById('taxYear').value;
  XLSX.writeFile(wb,`Raport_DT1_mToilet_${yr2}.xlsx`);
  toast(`✓ Raport pobrany — ${taxes.length} pojazdów, ${fmt2(total)} zł`);
}

// ==================== OCR ENGINE (Tesseract.js + formularz ręczny) ====================
let ocrFile=null,ocrBase64=null,ocrMime=null,ocrHistory=[],pendingVehId=null,pendingOcrData=null;
let tesseractWorker=null,tesseractReady=false;

// --- Inicjalizacja Tesseract ---
async function initTesseract(){
  if(tesseractReady)return true;
  try{
    tesseractWorker=await Tesseract.createWorker(['pol','eng'],1,{logger:m=>{
      const bar=document.getElementById('ocr-progress-bar');
      const stat=document.getElementById('ocr-status');
      if(bar&&m.progress){bar.style.width=(m.progress*100)+'%';}
      if(stat&&m.status){stat.textContent=({
        'loading tesseract core':'Ładowanie silnika OCR...',
        'loading language traineddata':'Ładowanie modelu językowego (PL)...',
        'initializing api':'Inicjalizacja API...',
        'recognizing text':'Rozpoznawanie tekstu...'
      }[m.status]||m.status);}
    }});
    tesseractReady=true;
    return true;
  }catch(e){console.error('Tesseract init error:',e);return false;}
}

// --- Obsługa pliku ---
function handleFileSelect(input){if(input.files&&input.files[0])processOcrFile(input.files[0]);}
function handleDrop(e){
  e.preventDefault();
  document.getElementById('ocr-dropzone').style.borderColor='var(--border2)';
  document.getElementById('ocr-dropzone').style.background='var(--bg2)';
  if(e.dataTransfer.files[0])processOcrFile(e.dataTransfer.files[0]);
}

function processOcrFile(f){
  if(f.size>20*1024*1024){toast('⚠ Plik za duży — maks. 20 MB');return;}
  // Wyczyść stan poprzedniego dokumentu
  window._ocrIsPdf=false;
  window._ocrPage2=null;
  window._ocrPage2Text=null;
  window._ocrCombinedText=null;
  window._ocrBase64=null;
  window._ocrLastRawText='';
  ocrFile=f; ocrMime=f.type||'image/jpeg';
  const reader=new FileReader();
  reader.onload=async e=>{
    const dataUrl=e.target.result;
    ocrBase64=dataUrl.split(',')[1];
    
    if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){
      // PDF: renderuj pierwszą stronę do canvas przez PDF.js
      try{
        const pdfjs=await loadPdfJs();
        const loadingTask=pdfjs.getDocument({data:atob(ocrBase64)});
        const pdf=await loadingTask.promise;
        const page=await pdf.getPage(1);
        const viewport=page.getViewport({scale:4.0});
        let canvas=document.createElement('canvas');
        canvas.width=viewport.width;
        canvas.height=viewport.height;
        const ctx=canvas.getContext('2d');
        await page.render({canvasContext:ctx,viewport}).promise;
        // Auto-orient: jeśli PDF jest poziomy (np. DR zapisany w landscape) — obróć
        if(canvas.width > canvas.height * 1.1) canvas=_rotateCanvas(canvas,90);
        const imgDataUrl=canvas.toDataURL('image/jpeg',0.97);
        ocrBase64=imgDataUrl.split(',')[1];
        ocrMime='image/jpeg';
        window._ocrIsPdf=true;
        document.getElementById('ocr-img').src=imgDataUrl;
        document.getElementById('ocr-img').style.display='block';
        document.getElementById('ocr-img').style.transform='';
        toast('✅ PDF załadowany — '+pdf.numPages+' str. | Kliknij "Uruchom OCR"');
        // Sprawdź też stronę 2 (tylna strona dowodu)
        if(pdf.numPages>1){
          const page2=await pdf.getPage(2);
          const vp2=page2.getViewport({scale:4.0});
          const c2=document.createElement('canvas');
          c2.width=vp2.width;c2.height=vp2.height;
          await page2.render({canvasContext:c2.getContext('2d'),viewport:vp2}).promise;
          window._ocrPage2=c2.toDataURL('image/jpeg',0.97);
          // Pre-OCR page 2 if Tesseract is ready
          if(tesseractReady&&tesseractWorker){
            try{
              const r2=await tesseractWorker.recognize(window._ocrPage2);
              window._ocrPage2Text=r2.data.text||'';
            }catch(e2){}
          }
        }
      }catch(err){
        console.warn('PDF.js error:',err);
        toast('⚠ PDF nie mógł być wyrenderowany: '+err.message);
        document.getElementById('ocr-img').style.display='none';
      }
    }else if(f.type.startsWith('image/')){
      window._ocrIsPdf=false;
      // Pokaż podgląd; auto-orient nastąpi przy kliknięciu "Uruchom OCR"
      document.getElementById('ocr-img').src=dataUrl;
      document.getElementById('ocr-img').style.display='block';
      // Pre-orient: jeśli obraz jest poziomy, obróć podgląd od razu
      try{
        const preImg=new Image();
        await new Promise(r=>{preImg.onload=r;preImg.onerror=r;setTimeout(r,8000);preImg.src=dataUrl;});
        if(preImg.width > preImg.height*1.1){
          const preC=document.createElement('canvas');
          preC.width=preImg.height;preC.height=preImg.width;
          const preCtx=preC.getContext('2d');
          preCtx.translate(preC.width/2,preC.height/2);
          preCtx.rotate(Math.PI/2);
          preCtx.drawImage(preImg,-preImg.width/2,-preImg.height/2);
          const rotUrl=preC.toDataURL('image/jpeg',0.95);
          ocrBase64=rotUrl.split(',')[1];ocrMime='image/jpeg';
          document.getElementById('ocr-img').src=rotUrl;
          toast('↩ Obraz obrócony automatycznie do orientacji pionowej');
        }
      }catch(e2){}
    }else{
      document.getElementById('ocr-img').style.display='none';
    }
    document.getElementById('ocr-preview').classList.remove('hidden');
    document.getElementById('ocr-btn-area').classList.remove('hidden');
    document.getElementById('ocr-result').classList.add('hidden');
    document.getElementById('ocr-result').innerHTML='';
  };
  reader.readAsDataURL(f);
}

// Obraca canvas o podany kąt (stopnie) i zwraca nowy canvas
function _rotateCanvas(canvas, deg) {
  if (deg === 0) return canvas;
  const rad = deg * Math.PI / 180;
  const c = document.createElement('canvas');
  if (deg === 90 || deg === 270) { c.width = canvas.height; c.height = canvas.width; }
  else { c.width = canvas.width; c.height = canvas.height; }
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return c;
}

// Automatyczna orientacja: Polski DR jest zawsze pionowy (portrait).
// Jeśli obraz jest poziomy (landscape), obracamy go o 90° — to rozwiązuje
// problem ze zdjęciami telefonu i skanami zapisanymi w złej orientacji.
// Zwraca { base64, mime, rotated: bool }
// Ładuje obraz z base64; nigdy nie zawiesza się (ma onerror + timeout 8s)
function _loadImg(base64, mime) {
  return new Promise(res => {
    const img = new Image();
    const done = () => res(img);
    const fail = () => res(null);
    img.onload  = done;
    img.onerror = fail;
    setTimeout(fail, 8000); // zabezpieczenie przed brakiem zdarzeń
    img.src = 'data:' + mime + ';base64,' + base64;
  });
}

async function _autoOrientForDR(base64, mime) {
  try {
    const img = await _loadImg(base64, mime);
    if (!img || img.width === 0) return { base64, mime, rotated: false }; // błąd ładowania — nie obracaj
    if (img.width <= img.height * 1.1) return { base64, mime, rotated: false }; // już portret
    // Landscape → obróć 90° zgodnie z ruchem wskazówek
    const c = document.createElement('canvas');
    c.width = img.height; c.height = img.width;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return { base64: c.toDataURL('image/jpeg', 0.95).split(',')[1], mime: 'image/jpeg', rotated: true };
  } catch(e) { return { base64, mime, rotated: false }; }
}

// Zmniejsza obraz do max `maxSide` px na dłuższym boku (dla AI Vision)
async function _resizeForVision(base64, mime, maxSide = 1600) {
  try {
    const img = await _loadImg(base64, mime);
    if (!img || img.width === 0) return { base64, mime };
    if (img.width <= maxSide && img.height <= maxSide) return { base64, mime };
    const sc = maxSide / Math.max(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { base64: c.toDataURL('image/jpeg', 0.92).split(',')[1], mime: 'image/jpeg' };
  } catch(e) { return { base64, mime }; }
}

// Poprawia kontrast obrazu przed OCR (grayscale + kontrast adaptywny)
function _enhanceCanvasForOcr(canvas){
  const ctx=canvas.getContext('2d');
  const id=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=id.data;
  let mn=255,mx=0;
  for(let i=0;i<data.length;i+=4){
    const g=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];
    if(g<mn)mn=g;if(g>mx)mx=g;
  }
  const rng=mx-mn||1;
  for(let i=0;i<data.length;i+=4){
    const g=Math.min(255,Math.max(0,Math.round((0.299*data[i]+0.587*data[i+1]+0.114*data[i+2]-mn)/rng*255)));
    // Dodaj odrobinę kontrastu S-curve
    const c=g<128?g*(g/128)*1.1:255-(255-g)*((255-g)/128)*0.9;
    data[i]=data[i+1]=data[i+2]=Math.min(255,Math.max(0,Math.round(c)));
  }
  ctx.putImageData(id,0,0);
}

let _pdfJsLoaded=false,_pdfJsLib=null;
async function loadPdfJs(){
  if(_pdfJsLoaded)return _pdfJsLib;
  if(window.pdfjsLib){_pdfJsLib=window.pdfjsLib;_pdfJsLoaded=true;return _pdfJsLib;}
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>{
      const lib=window.pdfjsLib;
      if(!lib){rej(new Error('pdfjsLib nie załadowany'));return;}
      lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      _pdfJsLib=lib;_pdfJsLoaded=true;res(lib);
    };
    s.onerror=()=>rej(new Error('Nie można załadować PDF.js'));
    document.head.appendChild(s);
  });
}

// ── AZTEC 2D — kod na polskim dowodzie rejestracyjnym ──────────────────────────
let _zxingLoaded=false;
async function loadZXing(){
  if(_zxingLoaded&&window.ZXing)return window.ZXing;
  if(window.ZXing){_zxingLoaded=true;return window.ZXing;}
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@zxing/library@0.20.0/umd/index.min.js';
    s.onload=()=>{_zxingLoaded=true;res(window.ZXing);};
    s.onerror=()=>rej(new Error('ZXing nie załadowany'));
    document.head.appendChild(s);
  });
}

async function tryAztecFromCanvas(canvas){
  if(!window.ZXing)return null;
  try{
    const hints=new Map([
      [ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.AZTEC]],
      [ZXing.DecodeHintType.TRY_HARDER,true],
      [ZXing.DecodeHintType.CHARACTER_SET,'ISO-8859-1'],
    ]);
    const reader=new ZXing.MultiFormatReader();
    reader.setHints(hints);
    const ctx=canvas.getContext('2d');
    const imgData=ctx.getImageData(0,0,canvas.width,canvas.height);
    const argb=new Int32Array(canvas.width*canvas.height);
    for(let i=0;i<argb.length;i++){
      argb[i]=(imgData.data[i*4]<<16)|(imgData.data[i*4+1]<<8)|imgData.data[i*4+2];
    }
    const lum=new ZXing.RGBLuminanceSource(argb,canvas.width,canvas.height);
    const bmp=new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(lum));
    const result=reader.decode(bmp);
    const text=result.getText();
    const bytes=new Uint8Array(text.length);
    for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i)&0xFF;
    return bytes;
  }catch(e){return null;}
}

async function tryAztecDR(){
  if(!ocrBase64)return false;
  try{
    await loadZXing();
    const img=new Image();
    await new Promise(r=>{img.onload=r;img.onerror=r;setTimeout(r,8000);img.src='data:'+(ocrMime||'image/jpeg')+';base64,'+ocrBase64;});
    const base=document.createElement('canvas');
    base.width=img.naturalWidth;base.height=img.naturalHeight;
    base.getContext('2d').drawImage(img,0,0);
    // Próbuj kodu AZTEC we wszystkich 4 orientacjach (dokument może być obrócony)
    let bytes=null;
    for(const deg of [0,90,270,180]){
      const c=_rotateCanvas(base,deg);
      bytes=await tryAztecFromCanvas(c);
      if(bytes&&bytes.length>=8)break;
    }
    if(!bytes||bytes.length<8)return false;
    const apiUrl=(window.CF_API_URL||'').replace(/\/$/,'');
    if(!apiUrl)return false;
    const token=localStorage.getItem('cf_token');
    let b64='';for(let i=0;i<bytes.length;i++)b64+=String.fromCharCode(bytes[i]);
    const resp=await fetch(apiUrl+'/api/aztec',{
      method:'POST',
      headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},
      body:JSON.stringify({bytesBase64:btoa(b64)}),
    });
    if(!resp.ok)return false;
    const data=await resp.json();
    if(!data.ok||!data.fields)return false;
    return data.fields;
  }catch(e){console.warn('[AZTEC]',e.message);return false;}
}

function resetOCR(){
  ocrFile=null;ocrBase64=null;
  document.getElementById('ocr-preview').classList.add('hidden');
  document.getElementById('ocr-btn-area').classList.add('hidden');
  document.getElementById('ocr-result').classList.add('hidden');
  document.getElementById('ocr-result').innerHTML='';
  document.getElementById('ocr-file').value='';
  document.getElementById('ocr-img').src='';
  document.getElementById('ocr-loader').classList.add('hidden');
}

// --- GŁÓWNA FUNKCJA OCR ---
async function runOCR(){
  if(!ocrBase64&&!ocrFile){showManualForm({});return;}
  const btn=document.getElementById('ocr-btn');
  btn.disabled=true;
  btn.innerHTML='<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Analizuję...';
  document.getElementById('ocr-loader').classList.remove('hidden');
  document.getElementById('ocr-btn-area').classList.add('hidden');
  document.getElementById('ocr-result').classList.add('hidden');

  try{
    const bar=document.getElementById('ocr-progress-bar');

    // ── Krok 1: Próba odczytu kodu AZTEC 2D (szybkie, 100% dokładne) ──────────
    btn.innerHTML='<i class="ti ti-qrcode"></i> Szukam kodu AZTEC...';
    bar.style.width='6%';
    const aztecFields=await tryAztecDR();
    if(aztecFields){
      bar.style.width='100%';
      setTimeout(()=>{
        document.getElementById('ocr-loader').classList.add('hidden');
        showManualForm({...aztecFields,pewnosc:'AZTEC'},null,null);
        _fillOcrFields(aztecFields);
      },300);
      document.getElementById('ocr-btn').disabled=false;
      document.getElementById('ocr-btn').innerHTML='<i class="ti ti-scan"></i> Uruchom OCR + Wypełnij formularz';
      return;
    }

    // ── Krok 2: AI Vision OCR (primarna — CF Workers AI → Groq fallback) ────────
    btn.innerHTML='<i class="ti ti-brain"></i> AI Vision analizuje skan...';
    bar.style.width='15%';
    try{
      const apiUrl=(window.CF_API_URL||'').replace(/\/$/,'');
      const token=localStorage.getItem('cf_token');
      console.log('[OCR step2] apiUrl='+apiUrl);
      if(apiUrl){
        // Auto-orient: DR jest zawsze pionowy; obróć jeśli poziomy
        const oriented=await _autoOrientForDR(ocrBase64, ocrMime||'image/jpeg');
        if(oriented.rotated){
          ocrBase64=oriented.base64; ocrMime=oriented.mime;
          // Aktualizuj podgląd
          const prevImg=document.getElementById('ocr-img');
          if(prevImg){prevImg.src='data:'+ocrMime+';base64,'+ocrBase64;prevImg.style.transform='';}
        }
        const resized=await _resizeForVision(oriented.base64, oriented.mime);
        console.log('[OCR step2] wysyłam do AI Vision, rozmiar base64='+resized.base64.length);
        const t0=Date.now();
        const visionResp=await fetch(apiUrl+'/api/ai/ocr',{
          method:'POST',
          headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},
          body:JSON.stringify({imageBase64:resized.base64,mimeType:resized.mime}),
        });
        console.log('[OCR step2] odpowiedź: status='+visionResp.status+' czas='+(Date.now()-t0)+'ms');
        if(visionResp.ok){
          const visionData=await visionResp.json();
          console.log('[OCR step2] visionData:', JSON.stringify(visionData).slice(0,300));
          if(visionData.ok&&visionData.fields){
            bar.style.width='100%';
            const merged={...visionData.fields,pewnosc:'AI-Vision',_aiModel:visionData.model||'ai'};
            setTimeout(()=>{
              document.getElementById('ocr-loader').classList.add('hidden');
              showManualForm(merged,null,null);
              _fillOcrFields(merged);
            },300);
            document.getElementById('ocr-btn').disabled=false;
            document.getElementById('ocr-btn').innerHTML='<i class="ti ti-scan"></i> Uruchom OCR + Wypełnij formularz';
            return;
          }
        }else{
          const errTxt=await visionResp.text().catch(()=>'');
          console.warn('[OCR step2] błąd HTTP '+visionResp.status+': '+errTxt.slice(0,200));
        }
      }
    }catch(e){console.warn('[OCR step2] wyjątek:',e.message);}

    // ── Krok 3: Tesseract OCR (fallback offline gdy AI Vision niedostępne) ──────
    btn.innerHTML='<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Analizuję...';
    bar.style.width='5%';
    const ok=await initTesseract();
    if(!ok)throw new Error('Nie udało się załadować silnika OCR');

    // Rozpoznaj tekst — PSM 11 (sparse text) lepszy dla formularzy DR
    bar.style.width='20%';
    await tesseractWorker.setParameters({'tessedit_pageseg_mode':'11'}).catch(()=>{});
    // Enhance contrast only for image uploads (not PDF — already rendered at 4x scale)
    let imgSrc='data:'+ocrMime+';base64,'+ocrBase64;
    if(ocrMime.startsWith('image/') && !window._ocrIsPdf){
      try{
        const tmpImg=new Image();
        await new Promise(r=>{tmpImg.onload=r;tmpImg.src=imgSrc;});
        const tmpC=document.createElement('canvas');
        tmpC.width=tmpImg.naturalWidth;tmpC.height=tmpImg.naturalHeight;
        tmpC.getContext('2d').drawImage(tmpImg,0,0);
        _enhanceCanvasForOcr(tmpC);
        imgSrc=tmpC.toDataURL('image/jpeg',0.97);
      }catch(e2){}
    }
    const result=await tesseractWorker.recognize(imgSrc);
    bar.style.width='35%';

    // Funkcja pomocnicza: rotuj canvas i uruchom Tesseract
    async function ocrAtAngle(src,deg){
      if(deg===0)return(await tesseractWorker.recognize(src)).data.text||'';
      const img=new Image();
      await new Promise(r=>{img.onload=r;img.src=src;});
      const c=document.createElement('canvas');
      const rad=deg*Math.PI/180;
      // Dla 90/270 zamień szerokość i wysokość
      if(deg===90||deg===270){c.width=img.height;c.height=img.width;}
      else{c.width=img.width;c.height=img.height;}
      const ctx=c.getContext('2d');
      ctx.translate(c.width/2,c.height/2);
      ctx.rotate(rad);
      ctx.drawImage(img,-img.width/2,-img.height/2);
      try{return(await tesseractWorker.recognize(c.toDataURL('image/jpeg',0.92))).data.text||'';}
      catch(e){return'';}
    }

    const rawText=result.data.text||'';
    bar.style.width='45%';

    // 180° — MRZ czytelne (linie MRZ są u dołu dokumentu)
    const rawText180=await ocrAtAngle(imgSrc,180).catch(()=>'');
    bar.style.width='60%';

    // 90° i 270° — dla dokumentów DR zeskanowanych bokiem (typowe dla polskich DR)
    const rawText90=await ocrAtAngle(imgSrc,90).catch(()=>'');
    bar.style.width='75%';
    const rawText270=await ocrAtAngle(imgSrc,270).catch(()=>'');
    bar.style.width='88%';

    const combinedText='---0---\n'+rawText+'\n---180---\n'+rawText180+'\n---90---\n'+rawText90+'\n---270---\n'+rawText270+(window._ocrPage2Text?'\n---page2---\n'+window._ocrPage2Text:'');
    window._ocrCombinedText=combinedText;
    window._ocrBase64=ocrBase64;
    const conf=result.data.confidence||0;

    // Parsuj regex (fallback)
    const parsedRegex=parseRegistrationDoc(combinedText||rawText);
    parsedRegex._rawText=rawText;
    parsedRegex._confidence=conf;
    bar.style.width='92%';

    // Wywołaj AI tekst jako główny wynik (znacznie dokładniejszy niż regex)
    let parsed=parsedRegex;
    try{
      const apiUrl=(window.CF_API_URL||'').replace(/\/$/,'');
      const token=localStorage.getItem('cf_token');
      if(apiUrl){
        btn.innerHTML='<i class="ti ti-brain"></i> AI analizuje tekst...';
        const aiPrompt=`Jesteś ekspertem od polskich dowodów rejestracyjnych. Przeanalizuj poniższy tekst OCR (zawiera 4 rotacje: 0°/90°/180°/270°) i wyodrębnij dane pojazdu. Zwróć WYŁĄCZNIE JSON bez markdown:
{"nrRej":"","dataRej":"DD.MM.RRRR","marka":"","typ":"","vin":"17 znakow","dmcKg":"F.1 cyfry z ŻÓŁTEJ tabeli DR NIE z sekcji homologacji","dmcKg2":"F.2 cyfry","dmcZespolu":"F.3 cyfry musi być >= F.1","masaWlKg":"G cyfry masa własna musi być < F.1","liczbaOsi":"1-5","kategoria":"np N3","pojSilnika":"tylko cyfry cm3","mocKW":"tylko cyfry","paliwo":"ON lub PB lub LPG","miejscaSied":"tylko cyfry","rokProd":"4 cyfry"}

Tekst OCR:\n${combinedText.slice(0,6000)}`;
        const aiResp=await fetch(apiUrl+'/api/ai/chat',{
          method:'POST',
          headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},
          body:JSON.stringify({message:aiPrompt,history:[]}),
        });
        if(aiResp.ok){
          const aiData=await aiResp.json();
          const aiText=aiData.answer||aiData.reply||aiData.message||'';
          const jm=aiText.match(/\{[\s\S]*\}/);
          if(jm){
            const aiFields=JSON.parse(jm[0]);
            // Scal: AI nadpisuje regex, ale VIN z regex jest bardziej zaufany jeśli 17 znaków
            const mergedVin=(parsedRegex.vin&&parsedRegex.vin.length===17)?parsedRegex.vin:aiFields.vin;
            parsed={...parsedRegex,...aiFields,vin:mergedVin,pewnosc:parsedRegex.pewnosc};
          }
        }
      }
    }catch(e){/* AI nie udało się — zostaje regex */}
    bar.style.width='100%';

    setTimeout(()=>{
      document.getElementById('ocr-loader').classList.add('hidden');
      showManualForm(parsed,rawText,conf);
    },400);

  }catch(e){
    document.getElementById('ocr-loader').classList.add('hidden');
    document.getElementById('ocr-btn-area').classList.remove('hidden');
    btn.disabled=false;
    btn.innerHTML='<i class="ti ti-scan"></i> Uruchom OCR + Wypełnij formularz';
    // Pokaż formularz ręczny z komunikatem błędu
    document.getElementById('ocr-result').classList.remove('hidden');
    document.getElementById('ocr-result').innerHTML=`<div class="wbox" style="margin-bottom:12px"><i class="ti ti-alert-triangle"></i><div><strong>OCR nie mógł przetworzyć pliku:</strong> ${esc(e.message)}<br><span style="font-size:11px">Formularz ręczny jest dostępny poniżej — wpisz dane z dokumentu.</span></div></div>`;
    showManualForm({});
  }
  document.getElementById('ocr-btn').disabled=false;
  document.getElementById('ocr-btn').innerHTML='<i class="ti ti-scan"></i> Uruchom OCR + Wypełnij formularz';
}

// --- PARSER POLSKIEGO DOWODU REJESTRACYJNEGO ---
function _normalizeNrRej(v){
  if(!v)return v;
  v=String(v).replace(/\s+/g,'').toUpperCase();
  const mm=v.match(/^([A-Z]{2,3})(.*)/);
  if(mm){let suf=mm[2].replace(/(\d)O/g,'$10').replace(/O(\d)/g,'0$1');suf=suf.replace(/00+/g,'0');v=mm[1]+suf;}
  return v;
}

function _fillOcrFields(d){
  // Normalizuj nrRej przed wypełnieniem (usuń spacje, popraw O/0)
  if(d.nrRej)d.nrRej=_normalizeNrRej(d.nrRej);
  const fill=(id,val)=>{const el=document.getElementById('ocrf-'+id);if(el&&val&&String(val).trim()&&String(val).trim()!=='null'&&String(val).trim()!=='undefined'){el.value=String(val).trim();el.style.borderColor='var(--green)';el.style.background='#f0fff0';}};
  fill('nrRej',d.nrRej);fill('dataRej',d.dataRej);fill('marka',d.marka);fill('typ',d.typ);
  fill('vin',d.vin);fill('dmcKg',d.dmcKg);fill('dmcKg2',d.dmcKg2);fill('dmcZespolu',d.dmcZespolu);fill('masaWlKg',d.masaWlKg);
  fill('liczbaOsi',d.liczbaOsi);fill('kategoria',d.kategoria);fill('pojSilnika',d.pojSilnika);
  fill('mocKW',d.mocKW);fill('paliwo',d.paliwo);fill('miejscaSied',d.miejscaSied);fill('rokProd',d.rokProd);
  fill('dmcPrzyczHam',d.dmcPrzyczHam);fill('dmcPrzyczNieham',d.dmcPrzyczNieham);fill('nrHomolog',d.nrHomolog);
  // Przelicz ładowność po wypełnieniu pól
  const _f2=parseFloat(d.dmcKg2)||0,_f1=parseFloat(d.dmcKg)||0,_g=parseFloat(d.masaWlKg)||0,_base=_f2||_f1;
  const _elL=document.getElementById('ocrf-ladownosc');
  if(_elL&&_base&&_g&&_base>_g)_elL.value=String(_base-_g);
}

async function extractOcrWithVision(){
  const base64=window._ocrBase64||ocrBase64;
  const mime=ocrMime||'image/jpeg';
  if(!base64){toast('Brak obrazu do analizy','warn');return;}
  const btn=document.getElementById('ocr-vision-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader2" style="animation:spin 1s linear infinite"></i> AI Vision analizuje...';}
  try{
    const apiUrl=(window.CF_API_URL||'').replace(/\/$/,'');
    if(!apiUrl)throw new Error('Brak adresu API — zaloguj się');
    const token=localStorage.getItem('cf_token');
    // Auto-orient + resize przed wysłaniem do AI Vision
    const oriented=await _autoOrientForDR(base64, mime);
    if(oriented.rotated){
      const prevImg=document.getElementById('ocr-img');
      if(prevImg){prevImg.src='data:'+oriented.mime+';base64,'+oriented.base64;prevImg.style.transform='';}
    }
    const {base64:sendBase64,mime:sendMime}=await _resizeForVision(oriented.base64, oriented.mime);
    const resp=await fetch(apiUrl+'/api/ai/ocr',{
      method:'POST',
      headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},
      body:JSON.stringify({imageBase64:sendBase64,mimeType:sendMime})
    });
    if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e.error||'HTTP '+resp.status);}
    const data=await resp.json();
    if(!data.ok||!data.fields)throw new Error('Brak danych z AI');
    _fillOcrFields(data.fields);
    toast('✅ AI Vision wyodrębnił dane — sprawdź i kliknij Szukaj');
  }catch(e){
    toast('⚠️ AI Vision: '+e.message,'warn');
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-eye"></i> AI Vision (ponów)';}
  }
}

async function extractOcrWithAI(){
  const rawText=(window._ocrCombinedText||window._ocrLastRawText||'');
  if(!rawText.trim()){toast('Brak tekstu OCR do analizy','warn');return;}
  const btn=document.getElementById('ocr-ai-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader2" style="animation:spin 1s linear infinite"></i> Analizuje AI...';}
  try{
    const apiUrl=(window.CF_API_URL||'').replace(/\/$/,'');
    if(!apiUrl)throw new Error('Brak adresu API — zaloguj się');
    const token=localStorage.getItem('cf_token');
    const prompt=`Jesteś ekspertem od polskich dowodów rejestracyjnych. Przeanalizuj poniższy tekst OCR (zawiera 4 rotacje: 0°/90°/180°/270°) i wyodrębnij dane pojazdu. Zwróć WYŁĄCZNIE JSON bez markdown:
{"nrRej":"","dataRej":"DD.MM.RRRR","marka":"","typ":"","vin":"17 znakow","dmcKg":"F.1 cyfry z ŻÓŁTEJ tabeli DR NIE z sekcji homologacji","dmcKg2":"F.2 cyfry","dmcZespolu":"F.3 cyfry musi być >= F.1","masaWlKg":"G cyfry masa własna musi być < F.1","liczbaOsi":"1-5","kategoria":"np N3","pojSilnika":"tylko cyfry cm3","mocKW":"tylko cyfry","paliwo":"ON lub PB lub LPG","miejscaSied":"tylko cyfry","rokProd":"4 cyfry"}

Tekst OCR:
${rawText.slice(0,6000)}`;
    const resp=await fetch(apiUrl+'/api/ai/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json',...(token?{'Authorization':'Bearer '+token}:{})},
      body:JSON.stringify({message:prompt,history:[]})
    });
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    const data=await resp.json();
    // Worker zwraca {answer:...}
    const text=data.answer||data.reply||data.message||data.content||JSON.stringify(data);
    const jm=text.match(/\{[\s\S]*\}/);
    if(!jm)throw new Error('AI nie zwróciło JSON');
    _fillOcrFields(JSON.parse(jm[0]));
    toast('✅ AI wyodrębnił dane — sprawdź pola i kliknij Szukaj');
  }catch(e){
    toast('⚠️ AI (tekst): '+e.message,'warn');
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-brain"></i> AI (tekst OCR) ponów';}
  }
}

function parseRegistrationDoc(combinedOcrText){
  const t=combinedOcrText||'';
  const d={};

  // ============================================================
  // 1. MRZ — z sekcji obrotu 180° (najdokładniejsza dla VIN i nr rej)
  // ============================================================
  function normMRZ(line){
    return line.toUpperCase().replace(/[()\[\]{}]/g,'<').replace(/\|/g,'1')
               .replace(/[^A-Z0-9<]/g,'<');
  }
  function getMRZ(src){
    const lines=src.split('\n').map(l=>l.trim()).filter(l=>l.length>=10);
    let l2='',l3='';
    for(const line of lines){
      const n=normMRZ(line);
      if(!n.includes('<'))continue;
      if(/^[A-Z]{2,3}\d{4,5}[A-Z]?<<</.test(n)&&!l3)l3=n;
      const pot=n.replace(/<.*$/,'').substring(0,17);
      if(pot.length>=11&&/^[A-HJ-NPR-Z0-9]{11,17}/.test(pot)&&!l2)l2=n;
    }
    return{l2,l3};
  }
  let mrzLine2='',mrzLine3='';
  for(const key of ['180','0','90','270']){
    const src=t.split(`---${key}---\n`)[1]||'';
    const{l2,l3}=getMRZ(src);
    if(!mrzLine3&&l3)mrzLine3=l3;
    if(!mrzLine2&&l2)mrzLine2=l2;
    if(mrzLine2&&mrzLine3)break;
  }
  if(!mrzLine3||!mrzLine2){const{l2,l3}=getMRZ(t);if(!mrzLine3)mrzLine3=l3;if(!mrzLine2)mrzLine2=l2;}
  if(mrzLine3){const m=mrzLine3.match(/^([A-Z]{2,3}\d{4,5}[A-Z]?)<<</);if(m)d.nrRej=m[1];}
  if(mrzLine2){const v=mrzLine2.replace(/[^A-HJ-NPR-Z0-9]/g,'').substring(0,17);if(v.length===17)d.vin=v;}

  // ============================================================
  // 2. Typ dokumentu
  // ============================================================
  d.typDok=/CZASOW|PC.AAK|POZWOLENIE CZASOWE/i.test(t)?'TYMCZASOWY':'STAŁY';

  // ============================================================
  // 3. VIN bezpośredni (fallback gdy MRZ nieczytelny)
  // ============================================================
  if(!d.vin){
    const vinM=t.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
    if(vinM)d.vin=vinM[1];
  }

  // ============================================================
  // 4. Data rejestracji (B) — wiele formatów
  //    Pole B = data PIERWSZEJ rejestracji → wybieramy NAJWCZEŚNIEJSZĄ datę
  //    (nie przyszłą — przeglądowy termin może być w przyszłości)
  // ============================================================
  const allDates=t.match(/\b(\d{2}[\s.\-\/]\d{2}[\s.\-\/](?:19|20)\d{2})\b/g)||[];
  const curY2=new Date().getFullYear();
  const validDates=allDates
    .map(dt=>dt.replace(/[\s\-\/]/g,'.'))
    .filter(dt=>{const y=parseInt(dt.slice(-4));return y>=1990&&y<=curY2;});
  if(validDates.length){
    // Sortuj chronologicznie (DD.MM.YYYY → porównaj jako YYYY-MM-DD)
    const _toSortKey=dt=>{const[dd,mm,yy]=dt.split('.');return `${yy}-${mm}-${dd}`;};
    validDates.sort((a,b)=>_toSortKey(a).localeCompare(_toSortKey(b)));
    d.dataRej=validDates[0]; // najwcześniejsza
  }

  // ============================================================
  // 5. Nr rejestracyjny (A) — tekst gdy MRZ nie zadziałał
  // ============================================================
  if(!d.nrRej){
    // Polskie tablice: 2-3 duże litery + sufiks zaczynający się od cyfry
    // Format: WA12345, POZ1234, SRZ123AB — sufiks musi zawierać co najmniej 1 cyfrę
    const plRej=t.match(/\b([A-Z]{2,3})[\s]?([0-9][A-Z0-9]{3,4}|[A-Z][0-9][A-Z0-9]{2,3}|[A-Z]{1,2}[0-9]{2,4}[A-Z]?)\b/);
    if(plRej){
      const candidate=(plRej[1]+plRej[2]).replace(/\s/g,'');
      if(/^[A-Z]{2}/.test(candidate)&&/\d/.test(candidate.slice(2)))d.nrRej=candidate;
    }
  }

  // ============================================================
  // 6. Marka (D.1) i Typ/Model (D.2)
  // ============================================================
  const BRANDS=['MERCEDES-BENZ','MERCEDES','SCANIA','VOLVO','MAN TGL','MAN TGX','MAN TGS',
    'MAN','DAF','IVECO','RENAULT','FORD','FIAT','BMW','VOLKSWAGEN','VW','CITROEN','PEUGEOT',
    'OPEL','TOYOTA','NISSAN','MITSUBISHI','ISUZU','HINO','KRONE','SCHMITZ','WIELTON',
    'FRUEHAUF','KOEGEL','FLIEGL','PANAV','KOGEL','STAR','JELCZ','AUTOSAN','SOLARIS','VOLVO'];
  for(const brand of BRANDS){
    const re2=new RegExp(brand.replace(/-/g,'[-/]?').replace(/\s/g,'[\\s\\-]?'),'i');
    if(re2.test(t)){
      d.marka=brand.split(/[-\s]/)[0].toUpperCase();
      const mM=t.match(new RegExp(brand.replace(/-/g,'[-/]?').replace(/\s/g,'[\\s\\-]?')+'[/\\s\\-]*([A-Z0-9]{2,12})','i'));
      if(mM&&mM[1]&&mM[1]!=='SP')d.typ=mM[1].toUpperCase();
      break;
    }
  }
  // Szukanie D.1 z etykiety formularza (toleruje OCR: D1/D.1/D-1)
  const d1M=t.match(/D[\s.:\-]?1\s*[:\|\-]?\s*([A-Z][A-Z\-]{2,25})(?:\s*[\/\|\n]|$)/im);
  if(d1M&&!d.marka)d.marka=d1M[1].trim().toUpperCase();
  const d2M=t.match(/D[\s.:\-]?2\s*[:\|\-]?\s*([A-Z0-9][A-Za-z0-9\-\s]{1,25})(?:\n|D[\s.:\-]?|$)/im);
  if(d2M&&!d.typ)d.typ=d2M[1].trim();

  // ============================================================
  // 7. DMC F.1/F.2/F.3 — szukaj najpierw w 90°/270° (prawidłowa orientacja DR)
  //    0° skan może zawierać wartości z sekcji homologacji (nagłówek) które są błędne
  // ============================================================
  const _sec90 =(t.split('---90---\n')[1]||'').split('---')[0];
  const _sec270=(t.split('---270---\n')[1]||'').split('---')[0];
  const _dmcSrc=_sec90+'\n'+_sec270;

  // Zbierz WSZYSTKICH kandydatów dla danego pola — wybierz MAX.
  // Powód: DR ma dwie sekcje z wartościami F.1/F.2/F.3:
  //   - beżowa sekcja homologacji (np. F.1=16285) — wartość MNIEJSZA
  //   - żółta tabela rejestracyjna (np. F.1=27000) — wartość WIĘKSZA, PRAWIDŁOWA
  // Math.max() zawsze wybiera wartość z żółtej tabeli.
  const _allVals=(src,re)=>{const r=[];let m;const rx=new RegExp(re.source,'gi');while((m=rx.exec(src))!==null){const v=parseInt(m[1]);if(v>=500&&v<=200000)r.push(v);}return r;};
  const _bestF=(re)=>{const all=[..._allVals(_dmcSrc,re),..._allVals(t,re)];return all.length?String(Math.max(...all)):null;};

  const f1v=_bestF(/F[\s.:\-]?[1lI!i]\s*[:\|\-]?\s*(\d{3,6})/i);
  if(f1v)d.dmcKg=f1v;
  const f3v=_bestF(/F[\s.:\-]?3\s*[:\|\-]?\s*(\d{3,6})/i);
  if(f3v)d.dmcZespolu=f3v;
  const f2v=_bestF(/F[\s.:\-]?2\s*[:\|\-]?\s*(\d{3,6})/i);
  if(f2v)d.dmcKg2=f2v;

  // Walidacja: F.3 musi być >= F.1
  if(d.dmcKg&&d.dmcZespolu&&parseInt(d.dmcKg)>parseInt(d.dmcZespolu)){
    const tmp=d.dmcKg;d.dmcKg=d.dmcZespolu;d.dmcZespolu=tmp;
  }

  // Fallback: wiersz z 3 dużymi liczbami (tabela F1/F2/F3)
  if(!d.dmcKg){
    const mRow=(_dmcSrc||t).match(/(\d{4,6})\D{1,10}(\d{4,6})\D{1,10}(\d{4,6})/);
    if(mRow){
      const nums=[parseInt(mRow[1]),parseInt(mRow[2]),parseInt(mRow[3])].filter(n=>n>=500&&n<=200000).sort((a,b)=>a-b);
      if(nums.length>=1)d.dmcKg=String(nums[0]);
      if(nums.length>=2&&!d.dmcKg2)d.dmcKg2=String(nums[1]);
      if(nums.length>=3)d.dmcZespolu=String(nums[nums.length-1]);
    }
  }

  // ============================================================
  // 8. Liczba osi (L) — szukaj z etykietą "L" lub "L:" lub w sekcji 90°/270°
  // ============================================================
  // Szukaj najpierw w sekcjach 90°/270° (tam DR jest czytelny)
  const _osiSrc=[
    (t.split('---90---\n')[1]||'').split('---')[0],
    (t.split('---270---\n')[1]||'').split('---')[0],
    (t.split('---0---\n')[1]||'').split('---')[0],
  ].join('\n');
  // Etykieta L z dwukropkiem/pipe/równa i cyfra 1-5 — tylko jeśli poprzedzone przez początek lub niealfa
  const osiM=_osiSrc.match(/(?:^|[\n\r|])\s*L\s*[:\|]\s*([1-5])\b/m)
    ||_osiSrc.match(/\bL\s+([1-5])\b(?!\d)/m)
    ||t.match(/(?:^|[\n\r|])\s*L\s*[:\|]\s*([1-5])\b/m)
    ||t.match(/\bL\s+([1-5])\b(?!\d)/m);
  if(osiM)d.liczbaOsi=osiM[1];

  // ============================================================
  // 9. Kategoria (J)
  // ============================================================
  const katM=t.match(/\bJ[\s:|\-]?\s*(N[1-3]|M[1-3]|O[1-4]|L[1-7])\b/i)
    ||t.match(/(?:^|\||\s)(N[1-3]|M[1-3])\s*(?:\||$)/m);
  if(katM)d.kategoria=(katM[1]||katM[2]||'').toUpperCase();

  // ============================================================
  // 10. Silnik: P.1 pojemność, P.2 moc, P.3 paliwo
  // ============================================================
  // P.1 — cm³: format "NNNN,NN" lub samo "NNNNN" — bez wymaganego "cm"
  const p1M=t.match(/P[\s.:\-]?1[\s:|\-]*(\d{3,6})[,.]?\d{0,2}/i)
    ||t.match(/(\d{4,6})[,.]\d{2}\s*cm[³3]?/i)
    ||t.match(/(\d{4,6})\s*cm[³3]?/i);
  if(p1M){const v=parseInt(p1M[1]);if(v>=50&&v<=100000)d.pojSilnika=String(v);}
  // P.2 — kW: format "NNN,NN" lub samo "NNN" kW
  const p2M=t.match(/P[\s.:\-]?2[\s:|\-]*(\d{2,4})[,.]?\d{0,2}/i)
    ||t.match(/(\d{2,4})[,.]\d{2}\s*kW/i)
    ||t.match(/(\d{2,4})\s*kW/i);
  if(p2M){const v=parseInt(p2M[1]);if(v>=1&&v<=3000)d.mocKW=String(v);}
  // P.3 — litera paliwa: D/B/G/E/H
  const p3M=t.match(/P[\s.:\-]?3[\s:|\-]*([DBGEH])\b/i);
  if(p3M){
    const fc=p3M[1].toUpperCase();
    d.paliwo=fc==='D'?'ON (Olej napędowy)':fc==='B'?'PB (Benzyna)':fc==='G'?'LPG':
             fc==='E'?'Elektryczny':fc==='H'?'Hybrydowy':fc;
  }
  if(!d.paliwo){
    if(/\bON\b|olej[\s_]nap[eę]d|diesel/i.test(t))d.paliwo='ON (Olej napędowy)';
    else if(/\bPB\b|benzyna|petrol|gasoline/i.test(t))d.paliwo='PB (Benzyna)';
    else if(/\bLPG\b|autogaz/i.test(t))d.paliwo='LPG';
    else if(/elektr[iy]/i.test(t))d.paliwo='Elektryczny';
    else if(/hybryd/i.test(t))d.paliwo='Hybrydowy';
  }

  // ============================================================
  // 11. Masa własna (G) — szukaj najpierw w 90°/270° (unikaj sekcji homologacji)
  // ============================================================
  const gM=_dmcSrc.match(/\bG\s*[:\|]?\s*(\d{4,6})\s*(?:kg|Kg|KG)?/i)
          ||t.match(/\bG\s*[:\|]?\s*(\d{4,6})\s*(?:kg|Kg|KG)?/i);
  if(gM){const v=parseInt(gM[1]);if(v>=100&&v<=100000)d.masaWlKg=String(v);}
  // Walidacja: G musi być mniejsze niż F.1
  if(d.masaWlKg&&d.dmcKg&&parseInt(d.masaWlKg)>=parseInt(d.dmcKg))delete d.masaWlKg;

  // ============================================================
  // 12. Miejsca siedzące (S.1)
  // ============================================================
  const s1M=t.match(/S[\s.:\-]?1[\s:|\-]*(\d{1,3})\b/i);
  if(s1M){const v=parseInt(s1M[1]);if(v>=1&&v<=500)d.miejscaSied=String(v);}

  // ============================================================
  // 12b. O.1 — Dop. masa przyczepy z hamulcem
  //      O.2 — Dop. masa przyczepy bez hamulca
  // ============================================================
  const o1M=_dmcSrc.match(/O[\s.:\-]?1\s*[:\|\-]?\s*(\d{3,6})/i)||t.match(/O[\s.:\-]?1\s*[:\|\-]?\s*(\d{3,6})/i);
  if(o1M){const v=parseInt(o1M[1]);if(v>=100&&v<=200000)d.dmcPrzyczHam=String(v);}
  const o2M=_dmcSrc.match(/O[\s.:\-]?2\s*[:\|\-]?\s*(\d{2,5})/i)||t.match(/O[\s.:\-]?2\s*[:\|\-]?\s*(\d{2,5})/i);
  if(o2M){const v=parseInt(o2M[1]);if(v>=50&&v<=50000)d.dmcPrzyczNieham=String(v);}

  // ============================================================
  // 12c. K — Numer świadectwa homologacji (np. e32*IV18/850*NI5391)
  // ============================================================
  const kM=t.match(/\bK\s*[:\|]?\s*([A-Za-z0-9][A-Za-z0-9\*\-\/\.]{4,30})/);
  if(kM&&/[0-9]/.test(kM[1]))d.nrHomolog=kM[1].trim();

  // ============================================================
  // 13. Rok produkcji — preferuj lata 1990-bieżący
  // ============================================================
  const rokMs=t.match(/\b(19[89]\d|20[012]\d)\b/g)||[];
  const curY=new Date().getFullYear();
  const validRok=rokMs.filter(y=>parseInt(y)>=1990&&parseInt(y)<=curY+1);
  if(validRok.length)d.rokProd=validRok[0];

  // ============================================================
  // 14. Norma Euro
  // ============================================================
  const euroM=t.match(/EURO\s*([IVX0-9]+(?:\s*D[-+]?)?)/i);
  if(euroM)d.euroNorma='Euro '+euroM[1].toUpperCase().trim();

  // Zawieszenie
  if(/pneumat/i.test(t))d.rodzajZawieszenia='pneumatyczne';
  else if(/r[oó]wnowa[żz]/i.test(t))d.rodzajZawieszenia='równoważne z pneumatycznym';

  // Walidacja VIN (17 znaków, tylko dopuszczalne znaki)
  if(d.vin&&(d.vin.length!==17||!/^[A-HJ-NPR-Z0-9]{17}$/.test(d.vin)))delete d.vin;

  // Normalizacja numeru rejestracyjnego:
  // 1) usuń wszystkie spacje (OCR często wstawia spację między prefix a sufiks)
  // 2) zamień O↔0 kontekstowo (cyfra+O → cyfra+0, O+cyfra → 0+cyfra)
  // 3) usuń podwójne zera (artefakt po zamianie 0O → 00)
  if(d.nrRej){
    d.nrRej=d.nrRej.replace(/\s+/g,'').toUpperCase();
    const mm=d.nrRej.match(/^([A-Z]{2,3})(.*)/);
    if(mm){let suf=mm[2].replace(/(\d)O/g,'$10').replace(/O(\d)/g,'0$1');suf=suf.replace(/00+/g,'0');d.nrRej=mm[1]+suf;}
    // Odrzuć jeśli brak cyfry (słowa-etykiety: "POJAZDU", "REJESTRACYJNY" itp.)
    if(!/\d/.test(d.nrRej)) delete d.nrRej;
  }

  // Pewność — wymaga kluczowych pól: nrRej+dataRej obowiązkowe dla WYSOKA
  const found=[d.nrRej,d.vin,d.marka,d.dmcKg,d.dataRej].filter(Boolean).length;
  const hasKeyFields=!!(d.nrRej&&d.dataRej);
  d.pewnosc=(found>=4&&hasKeyFields)?'WYSOKA':found>=2?'SREDNIA':'NISKA';
  return d;
}




// --- CEPiK — uzupełnianie formularza OCR danymi z CEPiK API ---
// Wymaga skonfigurowanego cepikToken lub cepikConsumerKey (zakładka CEPiK)
async function cepikFillOcrForm(){
  const nrRej=(document.getElementById('ocrf-nrRej')?.value||'').trim().toUpperCase().replace(/\s/g,'');
  if(!nrRej){toast('⚠ Najpierw wpisz lub zeskanuj numer rejestracyjny');return;}
  if(!cepikToken&&!cepikConsumerKey){
    toast('⚠ CEPiK nie skonfigurowany — przejdź do zakładki CEPiK i dodaj klucze API');return;
  }
  const btn=document.getElementById('ocrf-cepik-btn');
  if(btn){btn.disabled=true;btn.innerHTML='<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> CEPiK...';}
  try{
    const json=await cepikFetch(nrRej,'auto');
    const items=json?.data||[];
    if(!items.length){toast('⚠ Pojazd '+nrRej+' nie znaleziony w CEPiK w żadnym województwie — sprawdź numer');return;}
    const attrs=items[0]?.attributes||{};
    const d=parseCepikAttrs(attrs);

    // Mapowanie pól CEPiK → ID formularza OCR
    const _fill=(id,val,color='var(--blue)')=>{
      const el=document.getElementById('ocrf-'+id);
      if(el&&val!=null&&String(val).trim()){
        el.value=String(val).trim();
        el.style.borderColor=color;el.style.background='#eef4ff';
      }
    };
    _fill('marka',d.marka);
    _fill('typ',d.model);               // D.2 = CEPIK model
    _fill('przeznaczenie',d.przeznaczenie); // zwolnienie z DT-1 dla pojazdów specjalnych
    _fill('dmcKg',d.dmc);               // F.1
    _fill('dmcZespolu',d.dmcZespolu);   // F.3
    _fill('masaWlKg',d.masaWlasna);     // G
    _fill('liczbaOsi',d.osie);          // L
    _fill('paliwo',d.paliwo);           // P.3
    _fill('pojSilnika',d.pojSilnika);   // P.1
    _fill('mocKW',d.mocKW);             // P.2
    _fill('rokProd',d.rok);             // rok produkcji
    _fill('dataRej',d.dataRejestracji); // B
    // VIN — CEPIK zwraca jako 'numer-vin'
    const vin=attrs['numer-vin']||attrs['vin'];
    if(vin&&/^[A-HJ-NPR-Z0-9]{17}$/.test(String(vin).trim()))_fill('vin',vin);
    // Zawieszenie
    if(d.zawieszenie){const sel=document.getElementById('ocrf-zawieszenie');if(sel)sel.value=d.zawieszenie;}
    // Przelicz ładowność
    const base=parseFloat(d.dmc)||0,g=parseFloat(d.masaWlasna)||0;
    const elL=document.getElementById('ocrf-ladownosc');
    if(elL&&base&&g&&base>g)elL.value=String(base-g);

    const cnt=Object.values(d).filter(v=>v!=null).length;
    toast('✅ CEPiK: uzupełniono '+cnt+' pól dla '+nrRej+' — pola zaznaczone na niebiesko');
  }catch(e){
    toast('⚠ CEPiK: '+e.message.slice(0,80));
  }finally{
    if(btn){btn.disabled=false;btn.innerHTML='<i class="ti ti-database-search"></i> Uzupełnij z CEPiK';}
  }
}

// --- FORMULARZ RĘCZNY Z WYNIKAMI OCR ---
function showManualForm(d,rawText,conf){
  window._ocrLastRawText = rawText||'';
  document.getElementById('ocr-result').classList.remove('hidden');
  const confInfo=conf!=null?`<span style="font-size:11px;font-family:var(--mono);color:var(--text2)">Pewność Tesseract: ${Math.round(conf)}%</span>`:'';
  const isAztec=d.pewnosc==='AZTEC';
  const pewClass={WYSOKA:'gbox',SREDNIA:'ibox',NISKA:'wbox',AZTEC:'gbox'}[d.pewnosc]||'ibox';
  const pewIcon={WYSOKA:'ti-circle-check',SREDNIA:'ti-scan',NISKA:'ti-alert-triangle',AZTEC:'ti-qrcode'}[d.pewnosc]||'ti-scan';
  const isLow=d.pewnosc==='NISKA';

  let html='';

  if(rawText!==undefined){
    if(isAztec){
      html+=`<div class="gbox" style="margin-bottom:12px">
        <i class="ti ti-qrcode"></i>
        <div>
          <strong>Kod AZTEC 2D odczytany — dane pobrane bezpośrednio z dokumentu</strong><br>
          <span style="font-size:11px">Wszystkie pola zostały pobrane z elektronicznego kodu 2D z dowodu rejestracyjnego. Sprawdź i kliknij <strong>Szukaj i aktualizuj</strong>.</span>
        </div>
      </div>
      <div style="margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button id="ocr-vision-btn" onclick="extractOcrWithVision()" style="background:var(--bg3);color:var(--text1);border:1px solid var(--border);padding:8px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:5px">
          <i class="ti ti-eye"></i> Weryfikuj AI Vision
        </button>
        <span style="font-size:11px;color:var(--text3)">Dane z AZTEC są kompletne — AI Vision dostępne do weryfikacji</span>
      </div>`;
    }else{
      html+=`<div class="${pewClass}" style="margin-bottom:12px">
        <i class="ti ${pewIcon}"></i>
        <div>
          <strong>OCR zakończony — pewność: ${d.pewnosc||'?'}</strong> · ${confInfo}<br>
          <span style="font-size:11px">Sprawdź poniższe pola i popraw jeśli OCR się pomylił. Następnie kliknij <strong>Szukaj i aktualizuj</strong>.</span>
        </div>
      </div>`;
      html+=`<details style="margin-bottom:8px"${isLow?' open':''}>
        <summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:6px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">📄 Surowy tekst OCR (kliknij aby ${isLow?'zwinąć':'rozwinąć'})</summary>
        <pre style="font-size:10px;font-family:var(--mono);background:var(--bg3);padding:10px;border-radius:var(--radius);max-height:200px;overflow-y:auto;margin-top:4px;white-space:pre-wrap;color:var(--text2)">${(rawText||'').replace(/</g,'&lt;').slice(0,3000)}</pre>
      </details>`;
      html+=`<div style="margin-bottom:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button id="ocr-vision-btn" onclick="extractOcrWithVision()" style="background:#7c3aed;color:#fff;border:none;padding:9px 16px;border-radius:var(--radius);cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px">
          <i class="ti ti-eye"></i> AI Vision — odczytaj obraz
        </button>
        <button id="ocr-ai-btn" onclick="extractOcrWithAI()" style="background:var(--bg3);color:var(--text1);border:1px solid var(--border);padding:9px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:5px">
          <i class="ti ti-brain"></i> AI z tekstu OCR
        </button>
        <button id="ocrf-cepik-btn" onclick="cepikFillOcrForm()" style="background:#059669;color:#fff;border:none;padding:9px 14px;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px" title="Uzupełnij dane z bazy CEPiK (wymaga skonfigurowanych kluczy API)">
          <i class="ti ti-database-search"></i> Uzupełnij z CEPiK
        </button>
        <span style="font-size:11px;color:var(--text3)">AI Vision widzi obraz bezpośrednio — znacznie dokładniejszy</span>
      </div>`;
    }
  }else{
    html+=`<div class="ibox" style="margin-bottom:12px"><i class="ti ti-forms"></i><div><strong>Formularz ręczny</strong> — wpisz dane z dowodu rejestracyjnego. Pola odpowiadają polom formularza DT-1/A.</div></div>`;
  }

  // Formularz pól
  const field=(id,label,placeholder,val,hint)=>`
    <div class="f">
      <label>${label}${hint?`<span style="font-size:10px;font-weight:400;color:var(--text3);margin-left:6px">${hint}</span>`:''}</label>
      <input id="ocrf-${id}" class="fi" placeholder="${placeholder}" value="${esc(val)||''}"
        style="${val&&val!=='null'&&val!=='undefined'?'border-color:var(--green);background:#f0fff0':''}"
        oninput="document.getElementById('ocrf-${id}').style.borderColor='var(--border)';document.getElementById('ocrf-${id}').style.background='var(--bg2)'">
    </div>`;

  html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">
      <i class="ti ti-forms" style="color:var(--blue)"></i>Dane z dowodu rejestracyjnego
      <span style="font-size:11px;font-weight:400;color:var(--text2)">— pola podświetlone na zielono zostały rozpoznane automatycznie</span>
    </div>

    <div style="background:var(--blue-light);border-radius:var(--radius);padding:8px 12px;margin-bottom:14px;font-size:12px;color:var(--blue-dark)">
      <strong>Legenda pól:</strong> A=Nr rej. · B=Data 1.rej. · D.1=Marka · D.2=Typ · E=VIN · F.1=DMC · F.2=DMC z ład. · F.3=DMC zesp. · G=Masa wł. · L=Osie · P.3=Paliwo · J=Kategoria · S.1=Miejsca
    </div>

    <div class="fg" style="gap:12px">
      ${field('nrRej','🔑 A — Numer rejestracyjny','np. WA4789F',d.nrRej,'wymagane')}
      ${field('dataRej','📅 B — Data 1. rejestracji w RP','np. 15.03.2021',d.dataRej,'DD.MM.RRRR')}
      ${field('marka','🚛 D.1 — Marka','np. SCANIA',d.marka,'')}
      ${field('typ','D.2 — Typ / Model','np. R540',d.typ,'')}
      ${field('przeznaczenie','🚨 Przeznaczenie pojazdu','np. SAMOCHÓD SPECJALNY',d.przeznaczenie,'wpisz "specjalny" jeśli dotyczy — zwalnia z DT-1!')}
      ${field('vin','🔢 E — Numer VIN','17 znaków',d.vin,'17 znaków')}
      ${field('dmcKg','⚖️ F.1 — DMC pojazdu (kg)','np. 18000',d.dmcKg,'kg')}
      ${field('dmcKg2','📦 F.2 — DMC z ładunkiem (kg)','np. 24000',d.dmcKg2,'kg')}
      ${field('dmcZespolu','F.3 — DMC zespołu pojazdów (kg)','np. 40000',d.dmcZespolu,'kg — dla przyczep!')}
      ${field('masaWlKg','G — Masa własna (kg)','np. 8200',d.masaWlKg,'kg')}
      <div class="f">
        <label>Ładowność (obliczona)<span style="font-size:10px;font-weight:400;color:var(--text3);margin-left:6px">= F.2 − G (lub F.1 − G)</span></label>
        <input id="ocrf-ladownosc" class="fi" readonly placeholder="— auto —" value="${(()=>{const f2=parseFloat(d.dmcKg2)||0,f1=parseFloat(d.dmcKg)||0,g=parseFloat(d.masaWlKg)||0,base=f2||f1;return(base&&g&&base>g)?String(base-g):'';})()}"
          style="background:var(--bg3);cursor:default;color:var(--text2)">
      </div>
      ${field('liczbaOsi','L — Liczba osi pojazdu','np. 2',d.liczbaOsi,'1–5')}
      <div class="f">
        <label>Rodzaj zawieszenia</label>
        <select id="ocrf-zawieszenie" class="fi">
          <option value="pneumatyczne" ${(d.rodzajZawieszenia||'').includes('pneu')?'selected':''}>Pneumatyczne</option>
          <option value="równoważne" ${(d.rodzajZawieszenia||'').includes('r'+'ówno')?'selected':''}>Równoważne z pneumatycznym</option>
          <option value="inne" ${!d.rodzajZawieszenia||d.rodzajZawieszenia==='inne'?'selected':''}>Inny system</option>
        </select>
      </div>
      ${field('paliwo','P.3 — Rodzaj paliwa','np. ON lub PB',d.paliwo,'')}
      ${field('pojSilnika','P.1 — Pojemność (cm³)','np. 12742',d.pojSilnika,'cm³')}
      ${field('mocKW','P.2 — Moc silnika (kW)','np. 397',d.mocKW,'kW')}
      ${field('miejscaSied','S.1 — Miejsca siedzące','np. 3',d.miejscaSied,'bez kier.')}
      ${field('kategoria','J — Kategoria pojazdu','np. N3',d.kategoria,'N1/N2/N3/O/M')}
      ${field('rokProd','Rok produkcji','np. 2021',d.rokProd,'')}
      ${field('dmcPrzyczHam','O.1 — DMC przyczepy z hamulcem (kg)','np. 24000',d.dmcPrzyczHam,'kg')}
      ${field('dmcPrzyczNieham','O.2 — DMC przyczepy bez hamulca (kg)','np. 750',d.dmcPrzyczNieham,'kg')}
      ${field('nrHomolog','K — Numer świadectwa homologacji','np. e32*IV18/850*NI5391',d.nrHomolog,'')}
    </div>
  </div>

  <button class="btn btn-blue" style="width:100%;justify-content:center;padding:13px;font-size:14px;margin-bottom:8px" onclick="submitManualForm()">
    <i class="ti ti-search"></i>Szukaj pojazdu w bazie i porównaj dane
  </button>
  <div style="font-size:11px;color:var(--text3);text-align:center">Program przeszuka bazę wg numeru rejestracyjnego i pokaże co się zmieniło</div>`;

  document.getElementById('ocr-result').innerHTML=html;

  // Live kalkulator Ładowności
  setTimeout(()=>{
    const calcL=()=>{
      const f2=parseFloat(document.getElementById('ocrf-dmcKg2')?.value)||0;
      const f1=parseFloat(document.getElementById('ocrf-dmcKg')?.value)||0;
      const g=parseFloat(document.getElementById('ocrf-masaWlKg')?.value)||0;
      const base=f2||f1;
      const el=document.getElementById('ocrf-ladownosc');
      if(el){el.value=(base&&g&&base>g)?String(base-g):'';}
    };
    document.getElementById('ocrf-dmcKg2')?.addEventListener('input',calcL);
    document.getElementById('ocrf-dmcKg')?.addEventListener('input',calcL);
    document.getElementById('ocrf-masaWlKg')?.addEventListener('input',calcL);
  },50);

  // Dodaj do historii
  if(d.nrRej){
    ocrHistory.unshift({ts:new Date().toLocaleTimeString('pl-PL'),nrRej:d.nrRej,marka:d.marka||'',pewnosc:d.pewnosc||'?',found:false});
    renderOcrHistory();
  }
}

// --- PRZETWORZENIE FORMULARZA ---
function submitManualForm(){
  const g=id=>document.getElementById('ocrf-'+id)?.value?.trim()||null;
  const d={
    nrRej:g('nrRej'),dataRej:g('dataRej'),marka:g('marka'),typ:g('typ'),przeznaczenie:g('przeznaczenie'),vin:g('vin'),
    dmcKg:g('dmcKg'),dmcKg2:g('dmcKg2'),dmcZespolu:g('dmcZespolu'),masaWlKg:g('masaWlKg'),
    liczbaOsi:g('liczbaOsi'),zawieszenie:document.getElementById('ocrf-zawieszenie')?.value||'pneumatyczne',
    paliwo:g('paliwo'),pojSilnika:g('pojSilnika'),mocKW:g('mocKW'),
    miejscaSied:g('miejscaSied'),kategoria:g('kategoria'),rokProd:g('rokProd'),
    dmcPrzyczHam:g('dmcPrzyczHam'),dmcPrzyczNieham:g('dmcPrzyczNieham'),nrHomolog:g('nrHomolog'),
    pewnosc:'FORMULARZ',typDokumentu:ocrFile?'SKAN':'RĘCZNY'
  };
  if(!d.nrRej){toast('⚠ Wpisz numer rejestracyjny');return;}
  pendingOcrData=d;

  // Szukaj w bazie
  const nrRej=d.nrRej.toUpperCase().replace(/\s/g,'');
  const found=vehs.find(v=>v.nrRej.toUpperCase().replace(/\s/g,'')===nrRej);

  // Aktualizuj historię
  const h=ocrHistory.find(h=>h.nrRej===d.nrRej);
  if(h)h.found=!!found;
  renderOcrHistory();

  if(found){
    openUpdateModal(found.id,d);
  }else if(d.dmcKg&&parseFloat(d.dmcKg)>3500){
    const res=document.getElementById('ocr-result');
    const div=document.createElement('div');
    div.className='wbox'; div.style.marginTop='12px';
    div.innerHTML=`<i class="ti ti-alert-triangle"></i><div><strong>Pojazd ${esc(nrRej)} nie znaleziony w bazie.</strong> DMC: ${esc(String(d.dmcKg||''))} kg — podlega podatkowi DT-1.<br>
      <button class="btn btn-green" style="margin-top:8px" id="_ocr-add-btn"><i class="ti ti-plus"></i>Dodaj jako nowy pojazd</button></div>`;
    div.querySelector('#_ocr-add-btn').onclick = () => addNewFromOCR(d);
    res.appendChild(div);
    div.scrollIntoView({behavior:'smooth'});
  }else{
    toast('⚠ Pojazd '+esc(nrRej)+' nie znaleziony w bazie');
  }
}

// --- MODAL PORÓWNANIA ---
function openUpdateModal(vehId,d){
  const v=vehs.find(x=>x.id===vehId);
  if(!v)return;
  pendingVehId=vehId;

  const _ladownoscCalc=(dmc2,f1,masaWl)=>{const base=parseFloat(dmc2)||parseFloat(f1)||0;const g=parseFloat(masaWl)||0;return(base&&g&&base>g)?String(base-g):null;};
  const map=[
    {label:'VIN (E)',key:'vin',newVal:d.vin},
    {label:'DMC pojazdu kg (F.1)',key:'dmc',newVal:d.dmcKg?parseFloat(d.dmcKg):null},
    {label:'DMC z ładunkiem (F.2)',key:'dmcKg2',newVal:d.dmcKg2?parseFloat(d.dmcKg2):null},
    {label:'DMC zesp. kg (F.3)',key:'dmcZespolu',newVal:d.dmcZespolu?parseFloat(d.dmcZespolu):null},
    {label:'Masa własna kg (G)',key:'masaWlasna',newVal:d.masaWlKg?parseInt(d.masaWlKg):null},
    {label:'Ładowność (F.2−G)',key:'ladownosc',newVal:_ladownoscCalc(d.dmcKg2,d.dmcKg,d.masaWlKg)},
    {label:'Liczba osi (L)',key:'osie',newVal:d.liczbaOsi?parseInt(d.liczbaOsi):null},
    {label:'Zawieszenie (§17)',key:'zawieszenie',newVal:d.zawieszenie},
    {label:'Rok produkcji',key:'rok',newVal:d.rokProd?parseInt(d.rokProd):null},
    {label:'Marka (D.1)',key:'marka',newVal:d.marka},
    {label:'Model (D.2)',key:'model',newVal:d.typ},
    {label:'Przeznaczenie pojazdu (zwolnienie DT-1)',key:'przeznaczenie',newVal:d.przeznaczenie},
    {label:'Paliwo (P.3)',key:'paliwo',newVal:d.paliwo},
    {label:'Pojemność cm³ (P.1)',key:'pojSilnika',newVal:d.pojSilnika?parseInt(d.pojSilnika):null},
    {label:'Moc kW (P.2)',key:'mocKW',newVal:d.mocKW?parseInt(d.mocKW):null},
    {label:'Miejsca siedz. (S.1)',key:'miejscaSied',newVal:d.miejscaSied?parseInt(d.miejscaSied):null},
    {label:'Kategoria DR (J)',key:'katPojazdu',newVal:d.kategoria},
    {label:'Data 1. rejestracji',key:'dataRejestracji',newVal:d.dataRej},
    {label:'DMC przyczepy z ham. (O.1)',key:'dmcPrzyczHam',newVal:d.dmcPrzyczHam?parseInt(d.dmcPrzyczHam):null},
    {label:'DMC przyczepy bez ham. (O.2)',key:'dmcPrzyczNieham',newVal:d.dmcPrzyczNieham?parseInt(d.dmcPrzyczNieham):null},
    {label:'Nr homologacji (K)',key:'nrHomolog',newVal:d.nrHomolog},
  ].filter(c=>c.newVal!==null&&c.newVal!==undefined&&String(c.newVal).trim()!=='');

  const changes=map.map(c=>({...c,oldVal:v[c.key]||'—',changed:String(c.newVal).trim()!==String(v[c.key]||'').trim()}));
  const changedCount=changes.filter(c=>c.changed).length;

  document.getElementById('ocr-modal-body').innerHTML=`
    <div style="background:var(--blue-light);border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--blue-dark)">
      <strong>${esc(v.nrRej)} · ${esc(v.marka||'')} ${esc(v.model||'')}</strong><br>
      <span style="font-size:11px">Źródło: ${esc(d.typDokumentu||'formularz')} · Pewność: ${esc(String(d.pewnosc||'?'))} · ${changedCount} ${changedCount===1?'zmiana':'zmiany'} do zastosowania</span>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:36px 160px 1fr 1fr;background:var(--bg3);border-bottom:1px solid var(--border)">
        <div style="padding:8px"></div>
        <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">Pole DT-1</div>
        <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">📋 W bazie</div>
        <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--green)">📄 Z dokumentu</div>
      </div>
      ${changes.map((c,i)=>`
      <div style="display:grid;grid-template-columns:36px 160px 1fr 1fr;border-bottom:0.5px solid var(--border);align-items:center;${c.changed?'background:var(--blue-light)':''}">
        <div style="padding:8px;text-align:center"><input type="checkbox" id="ch2-${i}" ${c.changed?'checked':''} style="cursor:pointer"></div>
        <div style="padding:8px 12px;font-size:12px;font-weight:500">${esc(c.label)}</div>
        <div style="padding:8px 12px;font-size:12px;font-family:var(--mono);color:var(--text2)">${esc(String(c.oldVal??''))}</div>
        <div style="padding:8px 12px;font-size:12px;font-family:var(--mono);font-weight:600;color:${c.changed?'var(--blue)':'var(--text)'}">${esc(String(c.newVal??''))}
          ${c.changed?'<span class="diff-badge">ZMIANA</span>':''}</div>
      </div>`).join('')}
    </div>
    <div class="ibox"><i class="ti ti-info-circle"></i><span>Odznacz pola których <strong>nie</strong> chcesz aktualizować. Zalecamy weryfikację z oryginałem dokumentu.</span></div>`;

  document.getElementById('ocr-apply-btn').onclick=()=>applyOcrChanges(vehId,changes);
  document.getElementById('ocr-modal').classList.remove('hidden');
}

function applyOcrChanges(vehId,changes){
  const v=vehs.find(x=>x.id===vehId);
  if(!v)return;
  let applied=0;
  changes.forEach((c,i)=>{
    const chk=document.getElementById('ch2-'+i);
    if(chk&&chk.checked){v[c.key]=c.newVal;applied++;}
  });
  document.getElementById('ocr-modal').classList.add('hidden');
  toast(`✓ Zaktualizowano ${applied} pól — ${v.nrRej}`);
  renderVeh();updateCounters();
  if(ocrHistory[0])ocrHistory[0].applied=applied;
  renderOcrHistory();
  // Pokaż komunikat sukcesu
  const res=document.getElementById('ocr-result');
  if(res){
    const msg=document.createElement('div');
    msg.className='gbox';msg.style.marginBottom='12px';
    msg.innerHTML=`<i class="ti ti-circle-check"></i><strong>✓ Zaktualizowano ${applied} pól dla ${esc(v.nrRej)}.</strong> Sprawdź wyniki w zakładce <button class="btn btn-gray" style="padding:3px 8px;font-size:11px;margin-left:4px" onclick="showPage('pojazdy')">Pojazdy</button>`;
    res.prepend(msg);
    res.scrollIntoView({behavior:'smooth'});
  }
}

function addNewFromOCR(d){
  const dmc=parseFloat((d.dmcKg||'').toString().replace(',','.'))||0;
  if(dmc<=3500){toast('⚠ DMC ≤ 3500 kg — pojazd nie podlega DT-1');return;}
  const rokParsed=parseInt(d.rokProd)||0;
  if(rokParsed && (rokParsed<1900||rokParsed>2050)){toast('⚠ Rok produkcji poza zakresem 1900–2050 — sprawdź dane');return;}
  const masaWl=parseInt(d.masaWlKg)||0;
  const dmcF2=parseFloat((d.dmcKg2||'').toString().replace(',','.'))||0;
  const ladownosc=(dmcF2||dmc)&&masaWl&&(dmcF2||dmc)>masaWl?String((dmcF2||dmc)-masaWl):'';
  const newVeh={
    id:vehs.length,
    nrRej:(d.nrRej||'NOWY').toUpperCase().replace(/\s/g,''),
    marka:(d.marka||'Nieznana').toUpperCase(),
    model:d.typ||'—',
    rok:parseInt(d.rokProd)||0,
    typ:mapKatToTyp(d.kategoria),
    dmc,euro:'',vin:d.vin||'',
    status:'Własny',wlasciciel:'mToilet',
    osie:parseInt(d.liczbaOsi)||2,
    zawieszenie:d.zawieszenie||'pneumatyczne',
    dmcZespolu:parseFloat((d.dmcZespolu||'').toString().replace(',','.'))||0,
    miesiacePodatku:12,
    dataRejestracji:d.dataRej||'',
    dmcKg2:dmcF2||null,
    masaWlasna:masaWl||null,
    ladownosc:ladownosc||null,
    paliwo:d.paliwo||'',
    pojSilnika:parseInt(d.pojSilnika)||null,
    mocKW:parseInt(d.mocKW)||null,
    miejscaSied:parseInt(d.miejscaSied)||null,
    katPojazdu:d.kategoria||'',
    przeznaczenie:d.przeznaczenie||'',
  };
  vehs.push(newVeh);
  selected.add(newVeh.id);
  toast(`✓ Dodano ${newVeh.nrRej} — ${newVeh.marka} ${newVeh.model}`);
  window.TaxOrderFleetCloud?.saveVehicle(newVeh);
  renderVeh();updateCounters();showPage('pojazdy');
}

function mapKatToTyp(kat){
  const k=(kat||'').toUpperCase();
  if(['N2','N3'].includes(k))return 'Ciężarowy';
  if(k==='N1')return 'Ciężarowy';
  if(['O1','O2','O3','O4'].some(x=>k.startsWith(x)))return 'Przyczepa';
  if(['M2','M3'].includes(k))return 'Autobus';
  return 'Ciężarowy';
}

function renderOcrHistory(){
  const el=document.getElementById('ocr-history');
  if(!el)return;
  if(!ocrHistory.length){el.innerHTML='<span style="color:var(--text3);font-size:12px">Brak historii w tej sesji</span>';return;}
  el.innerHTML=ocrHistory.slice(0,8).map(h=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:0.5px solid var(--border);font-size:12px">
      <i class="ti ti-scan" style="color:var(--text3)"></i>
      <div style="flex:1"><strong>${esc(h.nrRej||'?')}</strong> <span style="color:var(--text2)">${esc(h.marka||'')}</span>
        <div style="font-size:10px;color:var(--text3)">${esc(h.ts||'')} · ${esc(h.pewnosc||'')}</div></div>
      <span class="pill ${h.found?'pill-green':'pill-amber'}" style="font-size:10px">${h.found?'Znaleziony':'Nowy'}</span>
      ${h.applied!=null?`<span class="pill pill-blue" style="font-size:10px">${h.applied} zm.</span>`:''}
    </div>`).join('');
}


// ==================== FAKTURY (Invoice OCR) ====================
let fakHistory = [], fakOcrWorkerReady = false;

function fakHandleDrop(e) {
  e.preventDefault();
  document.getElementById('fak-drop').style.borderColor='var(--border2)';
  document.getElementById('fak-drop').style.background='var(--bg2)';
  if(e.dataTransfer.files[0]) fakProcessFile(e.dataTransfer.files[0]);
}
function fakHandleFile(inp) { if(inp.files[0]) fakProcessFile(inp.files[0]); }

async function fakProcessFile(f) {
  if(f.size>10*1024*1024){toast('⚠ Plik za duży');return;}
  document.getElementById('fak-loader').classList.remove('hidden');
  document.getElementById('fak-bar').style.width='10%';
  document.getElementById('fak-form').classList.add('hidden');
  const reader=new FileReader();
  reader.onload=async e=>{
    const b64=e.target.result.split(',')[1];
    const mime=f.type||'image/jpeg';
    try {
      if(!tesseractReady) await initTesseract();
      document.getElementById('fak-bar').style.width='40%';
      const imgSrc='data:'+mime+';base64,'+b64;
      const result=await tesseractWorker.recognize(imgSrc);
      document.getElementById('fak-bar').style.width='90%';
      const parsed=parseFaktura(result.data.text||'');
      setTimeout(()=>{
        document.getElementById('fak-loader').classList.add('hidden');
        fakShowForm(parsed, result.data.text);
      },400);
    } catch(err) {
      document.getElementById('fak-loader').classList.add('hidden');
      fakShowForm({});
      toast('⚠ OCR nie powiódł się — wypełnij formularz ręcznie');
    }
  };
  reader.readAsDataURL(f);
}

function parseFaktura(txt) {
  const d={};
  const t=txt.replace(/\r/g,'\n');
  // Numer faktury
  const nrFak=t.match(/(?:faktura|nr|fv)[^\n]*?(FV|VAT|FS)?[-\/\s]?(\d{1,6}[\/\-]\d{2,4}(?:[\/\-]\d{2,4})?)/i);
  if(nrFak) d.nrFaktury=nrFak[0].trim().slice(0,40);
  // Data
  const dates=t.match(/\d{2}[.\-\/]\d{2}[.\-\/]\d{4}/g)||[];
  if(dates.length) d.data=dates[0];
  if(dates.length>1) d.dataSprzedazy=dates[1];
  // Ceny
  const netto=t.match(/(?:netto|wartość netto|razem netto)[:\s]+(\d[\d\s,\.]+)/i);
  if(netto) d.cenaNetto=netto[1].replace(/\s/g,'').replace(',','.');
  const brutto=t.match(/(?:brutto|do zapłaty|razem brutto|łącznie)[:\s]+(\d[\d\s,\.]+)/i);
  if(brutto) d.cenaBrutto=brutto[1].replace(/\s/g,'').replace(',','.');
  // NIP sprzedawcy
  const nipMatch=t.match(/(?:NIP|nip)[:\s]*(\d{3}[\-\s]?\d{3}[\-\s]?\d{2}[\-\s]?\d{2})/);
  if(nipMatch) d.nipSprzedawcy=nipMatch[1].replace(/[\s\-]/g,'');
  // Nazwa sprzedawcy (linia po "Sprzedawca:")
  const sprzMatch=t.match(/(?:sprzedawca|wystawca|nabywca)[:\s\n]+([^\n]{5,60})/i);
  if(sprzMatch) d.sprzedawca=sprzMatch[1].trim();
  // Nr rejestracyjny w opisie
  const plates=t.match(/\b([A-Z]{2,3}\s?\d{4,5}[A-Z]?)\b/g)||[];
  if(plates.length) d.nrRej=plates[0].replace(/\s/g,'').toUpperCase();
  // Typ zdarzenia
  d.typZdarzenia=t.match(/sprzeda[żz]|zby[ćc]/i)?'SPRZEDAŻ':'ZAKUP';
  return d;
}

function fakShowForm(d, rawText) {
  const el=document.getElementById('fak-form');
  el.classList.remove('hidden');
  const fld=(id,lbl,val,ph,hint)=>`<div class="f">
    <label>${lbl}${hint?`<span style="font-size:10px;color:var(--text3);margin-left:5px">${hint}</span>`:''}  </label>
    <input id="fakf-${id}" class="fi" value="${esc(val||'')}" placeholder="${ph}"
      style="${val?'border-color:var(--green);background:#f0fff0':''}">
  </div>`;

  el.innerHTML=`
    ${rawText?`<details style="margin-bottom:10px"><summary style="cursor:pointer;font-size:12px;color:var(--text2);padding:6px;background:var(--bg3);border-radius:var(--radius)">📄 Surowy tekst OCR (rozwiń)</summary>
      <pre style="font-size:10px;font-family:var(--mono);background:var(--bg3);padding:8px;max-height:150px;overflow-y:auto;white-space:pre-wrap;color:var(--text2)">${(rawText||'').replace(/</g,'&lt;').slice(0,2000)}</pre></details>`:''}
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <i class="ti ti-receipt" style="color:var(--blue)"></i>Dane z faktury
        <span style="font-size:11px;font-weight:400;color:var(--text2)">— zielone = rozpoznane automatycznie</span>
      </div>
      <div class="fg" style="gap:10px">
        <div class="f"><label>Typ zdarzenia</label>
          <select id="fakf-typ" class="fi">
            <option value="ZAKUP" ${(d.typZdarzenia||'ZAKUP')==='ZAKUP'?'selected':''}>🟢 ZAKUP pojazdu</option>
            <option value="SPRZEDAŻ" ${d.typZdarzenia==='SPRZEDAŻ'?'selected':''}>🔴 SPRZEDAŻ / zbycie pojazdu</option>
            <option value="LEASING">📋 Umowa leasingowa</option>
            <option value="INNE">📌 Inne zdarzenie</option>
          </select>
        </div>
        ${fld('nrRej','🔑 Nr rejestracyjny pojazdu',d.nrRej,'np. WA4789F','wymagane')}
        ${fld('data','📅 Data wystawienia faktury',d.data,'DD.MM.RRRR','')}
        ${fld('dataSprzedazy','📅 Data sprzedaży / nabycia',d.dataSprzedazy||d.data,'DD.MM.RRRR','dla DT-1')}
        ${fld('nrFaktury','🔢 Nr faktury / umowy',d.nrFaktury,'np. FV/12/2026','')}
        ${fld('sprzedawca','🏢 Sprzedawca / wystawca',d.sprzedawca,'nazwa firmy','')}
        ${fld('nipSprzedawcy','NIP sprzedawcy',d.nipSprzedawcy,'10 cyfr','')}
        ${fld('cenaNetto','💰 Cena netto (zł)',d.cenaNetto,'np. 150000.00','')}
        ${fld('cenaBrutto','💳 Cena brutto (zł)',d.cenaBrutto,'np. 184500.00','')}
        <div class="f full"><label>📝 Uwagi</label><input id="fakf-uwagi" class="fi" placeholder="Opcjonalne uwagi..."></div>
      </div>
    </div>
    <button class="btn btn-blue" style="width:100%;justify-content:center;padding:12px;font-size:14px" onclick="fakSubmit()">
      <i class="ti ti-check"></i>Zapisz zdarzenie i aktualizuj pojazd w bazie
    </button>`;
}

function fakSubmit() {
  const g=id=>document.getElementById('fakf-'+id)?.value?.trim()||'';
  const nrRej=g('nrRej').toUpperCase().replace(/\s/g,'');
  if(!nrRej){toast('⚠ Wpisz numer rejestracyjny');return;}
  const ev={
    nrRej, typ:document.getElementById('fakf-typ').value,
    data:g('data'), dataSprzedazy:g('dataSprzedazy'),
    nrFaktury:g('nrFaktury'), sprzedawca:g('sprzedawca'),
    nipSprzedawcy:g('nipSprzedawcy'), cenaNetto:g('cenaNetto'),
    cenaBrutto:g('cenaBrutto'), uwagi:g('uwagi'),
    ts:new Date().toLocaleString('pl-PL')
  };
  fakHistory.unshift(ev);
  renderFakHistory();

  // Aktualizuj pojazd w bazie
  const v=vehs.find(x=>x.nrRej.toUpperCase().replace(/\s/g,'')=== nrRej);
  if(v){
    if(ev.typ==='ZAKUP'&&ev.dataSprzedazy){
      v.dataNabycia=ev.dataSprzedazy;
      // Przelicz miesiące podatkowe
      const parts=ev.dataSprzedazy.split('.');
      if(parts.length===3){
        const d=new Date(parseInt(parts[2]),parseInt(parts[1])-1,parseInt(parts[0]));
        const yr=parseInt(document.getElementById('taxYear').value)||new Date().getFullYear();
        const startMonth=d.getMonth()+2; // od następnego miesiąca
        v.miesiacePodatku=Math.max(1,Math.min(12,13-startMonth));
      }
    }
    if(ev.typ==='SPRZEDAŻ'&&ev.dataSprzedazy){
      v.dataZbycia=ev.dataSprzedazy;
      const parts=ev.dataSprzedazy.split('.');
      if(parts.length===3){
        const d=new Date(parseInt(parts[2]),parseInt(parts[1])-1,parseInt(parts[0]));
        v.miesiacePodatku=Math.max(1,d.getMonth()+1);
      }
    }
    toast(`✓ Zdarzenie zapisane dla ${nrRej} — miesiące: ${v.miesiacePodatku}`);
    renderVeh(); updateCounters();
  } else {
    toast(`⚠ Pojazd ${nrRej} nie znaleziony w bazie — zdarzenie zapisane tylko w historii`);
  }
  document.getElementById('fak-form').classList.add('hidden');
}

function renderFakHistory() {
  const el=document.getElementById('fak-history-list');
  if(!el)return;
  const q=(document.getElementById('fak-search-veh')?.value||'').toLowerCase();
  const list=fakHistory.filter(h=>!q||h.nrRej.toLowerCase().includes(q));
  if(!list.length){el.innerHTML='<span style="color:var(--text3)">Brak historii</span>';return;}
  el.innerHTML=list.map(h=>`<div style="padding:8px 0;border-bottom:0.5px solid var(--border);font-size:12px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
      <span class="pill ${h.typ==='ZAKUP'?'pill-green':h.typ==='SPRZEDAŻ'?'pill-red':'pill-amber'}" style="font-size:10px">${h.typ}</span>
      <strong>${h.nrRej}</strong>
      <span style="color:var(--text3);font-size:10px;margin-left:auto">${h.data||h.ts}</span>
    </div>
    <div style="color:var(--text2)">${h.sprzedawca||'—'} ${h.cenaBrutto?'· '+h.cenaBrutto+' zł':''}</div>
    ${h.nrFaktury?`<div style="font-family:var(--mono);font-size:10px;color:var(--text3)">${h.nrFaktury}</div>`:''}
  </div>`).join('');
}

// ── Eksport faktur kosztowych do pliku CSV (rozwiązanie pośrednie do czasu
//    potwierdzenia dostępu do API enova365 — import ręczny przez "Mechanizm wymiany danych") ──
function exportFakturyToFK() {
  if (!fakHistory.length) { toast('⚠ Brak zdarzeń do eksportu'); return; }
  const headers = ['Typ', 'Nr dokumentu', 'Data wystawienia', 'Data sprzedaży', 'Kontrahent (nazwa)', 'Kontrahent (NIP)', 'Kwota netto', 'Kwota brutto', 'Nr rej. pojazdu', 'Uwagi'];
  const rows = fakHistory.map(h => [
    h.typ || '', h.nrFaktury || '', h.data || '', h.dataSprzedazy || h.data || '',
    h.sprzedawca || '', h.nipSprzedawcy || '', h.cenaNetto || '', h.cenaBrutto || '',
    h.nrRej || '', h.uwagi || '',
  ]);
  const csv = '﻿' + [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `faktury_eksport_FK_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`✓ Wyeksportowano ${rows.length} pozycji — gotowe do importu w enova365 (Mechanizm wymiany danych)`);
}

// ==================== PDF EXPORT ====================
function refreshPdfPreview() {
  showPage('formularze');
  renderFormularze();
  document.getElementById('pdf-preview').innerHTML=`<div style="padding:1rem;font-size:13px;color:var(--text2);text-align:center">
    <i class="ti ti-check" style="color:var(--green);font-size:20px;display:block;margin-bottom:6px"></i>
    Formularze gotowe — przejdź do zakładki <strong>DT-1 / DT-1/A</strong> aby zobaczyć pełny podgląd.<br>
    <button class="btn btn-gray" style="margin-top:8px" onclick="showPage('formularze')"><i class="ti ti-eye"></i>Otwórz podgląd formularzy</button>
  </div>`;
  showPage('pdfexport');
  updatePdfSummary();
}

function updatePdfSummary() {
  const selT=getSelTax();
  const taxable=selT.filter(v=>v.cat);
  const total=totalTax();
  const attCount=Math.ceil(taxable.length/3)||0;
  const el1=document.getElementById('pdf-cnt-v');if(el1)el1.textContent=selT.length;
  const el2=document.getElementById('pdf-cnt-att');if(el2)el2.textContent=attCount;
  const el3=document.getElementById('pdf-cnt-total');if(el3)el3.textContent=1+attCount;
  const el4=document.getElementById('pdf-cnt-tax');if(el4)el4.textContent=fmt2(total)+' zł';
  const el5=document.getElementById('pdf-veh-count');if(el5)el5.textContent=selT.length;
}

async function generatePDF() {
  const selT=getSelTax().filter(v=>v.cat);
  if(selT.length===0){toast('⚠ Zaznacz pojazdy w zakładce Pojazdy');return;}

  toast('⏳ Generuję PDF — może potrwać kilkanaście sekund...');

  // Upewnij się że formularze są wygenerowane
  renderFormularze();
  await new Promise(r=>setTimeout(r,500));

  const content=document.getElementById('pdf-content')?.value||'all';
  const fmt=document.getElementById('pdf-format')?.value||'a4';
  const orient=document.getElementById('pdf-orient')?.value||'portrait';
  const scale=parseFloat(document.getElementById('pdf-scale')?.value||'0.9');

  try {
    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:orient,unit:'mm',format:fmt});
    const pW=orient==='portrait'?(fmt==='a4'?210:297):(fmt==='a4'?297:420);
    const pH=orient==='portrait'?(fmt==='a4'?297:420):(fmt==='a4'?210:297);

    // Zbierz elementy form-page
    const formPages=document.querySelectorAll('#forms-container .form-page');
    if(!formPages.length){toast('⚠ Brak formularzy do eksportu');return;}

    let pageIdx=0;
    for(const fp of formPages){
      if(content==='dt1only'&&fp.closest('#forms-container')&&pageIdx>0)break;
      if(content==='dt1aonly'&&pageIdx===0){pageIdx++;continue;}

      const canvas=await html2canvas(fp,{
        scale:2,useCORS:true,allowTaint:true,
        backgroundColor:'#ffffff',
        logging:false
      });
      const imgData=canvas.toDataURL('image/jpeg',0.92);
      const cW=canvas.width/2; const cH=canvas.height/2;
      const ratio=Math.min((pW-10)/cW,(pH-10)/cH)*scale;
      const iW=cW*ratio; const iH=cH*ratio;
      const xOff=(pW-iW)/2; const yOff=5;

      if(pageIdx>0) pdf.addPage(fmt,orient);
      pdf.addImage(imgData,'JPEG',xOff,yOff,iW,iH);
      pageIdx++;
    }

    const yr=document.getElementById('taxYear').value;
    const nip=tp('tp-nip')||'podatnik';
    pdf.save(`DT1_${nip}_${yr}.pdf`);
    toast(`✓ PDF pobrany — ${pageIdx} stron(y)`);

  } catch(err) {
    console.error(err);
    toast('⚠ Błąd generowania PDF: '+err.message+' — spróbuj Drukuj przez przeglądarkę');
  }
}

// ==================== IMPORT / EKSPORT ====================

// --- Import Excel ---
function impXlDrop(e) {
  e.preventDefault();
  document.getElementById('imp-xl-drop').style.borderColor='var(--border2)';
  if(e.dataTransfer.files[0]) impXlProcess(e.dataTransfer.files[0]);
}
function impXlHandle(inp) { if(inp.files[0]) impXlProcess(inp.files[0]); }

function impXlProcess(f) {
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const wb=XLSX.read(e.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length){document.getElementById('imp-xl-result').innerHTML='<div class="ebox"><i class="ti ti-alert-circle"></i>Plik pusty</div>';return;}
      const headers=Object.keys(rows[0]);
      // Mapowanie kolumn
      const find=(names)=>headers.find(h=>names.some(n=>h.toLowerCase().replace(/[ąćęłńóśźż]/g,c=>({ą:'a',ć:'c',ę:'e',ł:'l',ń:'n',ó:'o',ś:'s',ź:'z',ż:'z'})[c]||c).replace(/\s/g,'').includes(n)))||null;
      const colNrRej=find(['nrrej','rejestr','tablica','nr_rej']);
      const colMarka=find(['marka','make','producent']);
      const colModel=find(['model']);
      const colRok=find(['rokprod','rokprodu','rok_prod','rok']);
      const colTyp=find(['typ','rodzaj','type']);
      const colDmc=find(['dmc','masacalk','dopuszczalna']);
      const colEuro=find(['euro','emisja']);
      const colVin=find(['vin','podwozia','nadwozia']);
      const colStatus=find(['statuswlasn','status','wlasnosc']);
      const colWl=find(['wlasciciel','owner','posiadacz']);

      const imported=[];
      rows.forEach((row,i)=>{
        const nrRej=String(row[colNrRej]||'').trim();
        const dmc=parseFloat(String(row[colDmc]||'0').replace(',','.'))||0;
        if(!nrRej&&dmc<=0)return;
        if(dmc>0&&dmc<=3500)return; // pomiń pojazdy <3.5t
        imported.push({
          id:vehs.length+imported.length,
          nrRej:nrRej.toUpperCase(),
          marka:String(row[colMarka]||'').trim(),
          model:String(row[colModel]||'').trim(),
          rok:parseInt(row[colRok])||0,
          typ:String(row[colTyp]||'Ciężarowy').trim(),
          dmc,
          euro:String(row[colEuro]||'').trim(),
          vin:String(row[colVin]||'').trim(),
          status:String(row[colStatus]||'Własny').trim(),
          wlasciciel:String(row[colWl]||'mToilet').trim(),
          osie:dmc>=12000?3:2,zawieszenie:'pneumatyczne',dmcZespolu:0,miesiacePodatku:12
        });
      });

      // Pokaż podgląd
      showImpPreview(imported,'xl');
      document.getElementById('imp-xl-result').innerHTML=`<div class="gbox"><i class="ti ti-circle-check"></i>Wczytano ${imported.length} pojazdów z ${rows.length} wierszy. Sprawdź podgląd poniżej.</div>`;
    } catch(err) {
      document.getElementById('imp-xl-result').innerHTML=`<div class="ebox"><i class="ti ti-alert-circle"></i>Błąd odczytu: ${err.message}</div>`;
    }
  };
  reader.readAsArrayBuffer(f);
}

// --- Import CSV ---
function impCsvHandle(inp) {
  if(!inp.files[0])return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const lines=e.target.result.split('\n').filter(Boolean);
      if(lines.length<2){document.getElementById('imp-csv-result').innerHTML='<div class="ebox">Plik pusty</div>';return;}
      const headers=lines[0].split(/[,;]/).map(h=>h.trim().toLowerCase());
      const imported=[];
      lines.slice(1).forEach((line,i)=>{
        const vals=line.split(/[,;]/).map(v=>v.trim().replace(/^"|"$/g,''));
        const row={};
        headers.forEach((h,j)=>row[h]=vals[j]||'');
        const dmc=parseFloat(row['dmc']||row['masa']||'0')||0;
        if(dmc>3500||row['nrrej']||row['nr rej']) {
          imported.push({
            id:vehs.length+imported.length,
            nrRej:(row['nrrej']||row['nr rej']||'').toUpperCase(),
            marka:row['marka']||'',model:row['model']||'',
            rok:parseInt(row['rok'])||0,typ:row['typ']||'Ciężarowy',
            dmc,euro:row['euro']||'',vin:row['vin']||'',
            status:row['status']||'Własny',wlasciciel:row['wlasciciel']||'mToilet',
            osie:dmc>=12000?3:2,zawieszenie:'pneumatyczne',dmcZespolu:0,miesiacePodatku:12
          });
        }
      });
      showImpPreview(imported,'csv');
      document.getElementById('imp-csv-result').innerHTML=`<div class="gbox"><i class="ti ti-circle-check"></i>Wczytano ${imported.length} pojazdów.</div>`;
    } catch(err) {
      document.getElementById('imp-csv-result').innerHTML=`<div class="ebox">Błąd: ${err.message}</div>`;
    }
  };
  reader.readAsText(inp.files[0],'UTF-8');
}

// --- Import JSON ---
function impJsonHandle(inp) {
  if(!inp.files[0])return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const state=JSON.parse(e.target.result);
      if(state.vehs&&Array.isArray(state.vehs)){
        const count=state.vehs.length;
        // Przywróć pojazdy
        vehs.splice(0,vehs.length,...state.vehs);
        selected.clear();
        if(state.selected) state.selected.forEach(id=>selected.add(id));
        if(state.taxpayer) Object.entries(state.taxpayer).forEach(([k,v])=>taxpayer[k]=v);
        if(state.fakHistory) fakHistory.splice(0,fakHistory.length,...state.fakHistory);
        if(state.decReason) decReason=state.decReason;
        // Odśwież UI
        renderVeh(); updateCounters(); renderFakHistory();
        // Wstaw dane podatnika
        Object.entries(taxpayer).forEach(([k,v])=>{const el=document.getElementById('tp-'+k.replace(/([A-Z])/g,'-$1').toLowerCase());if(el)el.value=v;});
        document.getElementById('imp-json-result').innerHTML=`<div class="gbox"><i class="ti ti-circle-check"></i>Wczytano ${count} pojazdów + dane sesji.</div>`;
        toast(`✓ Backup wczytany — ${count} pojazdów, ${state.selected?.length||0} zaznaczonych`);
      }else{throw new Error('Nieprawidłowy format JSON');}
    } catch(err) {
      document.getElementById('imp-json-result').innerHTML=`<div class="ebox">Błąd: ${err.message}</div>`;
    }
  };
  reader.readAsText(inp.files[0],'UTF-8');
}

// --- Podgląd importu ---
let pendingImport=[];
function showImpPreview(rows,source) {
  pendingImport=rows;
  const el=document.getElementById('imp-preview');
  const body=document.getElementById('imp-preview-body');
  el.classList.remove('hidden');
  const sample=rows.slice(0,20);
  body.innerHTML=`<div class="tbl-wrap" style="margin-bottom:12px"><table>
    <thead><tr><th>Nr rej.</th><th>Marka</th><th>Model</th><th>Rok</th><th>Typ</th><th>DMC (kg)</th><th>Status</th><th>EURO</th></tr></thead>
    <tbody>${sample.map(v=>`<tr>
      <td><strong style="font-family:var(--mono)">${esc(v.nrRej||'—')}</strong></td>
      <td>${esc(v.marka||'—')}</td><td>${esc(v.model||'—')}</td><td>${v.rok||'—'}</td>
      <td><span class="pill pill-gray">${esc(v.typ||'—')}</span></td>
      <td style="font-family:var(--mono)">${(v.dmc||v.dmcMax||0).toLocaleString('pl-PL')}</td>
      <td><span class="pill ${STAT_LABELS[v.status]||'pill-gray'}">${esc(v.status||'—')}</span></td>
      <td style="font-size:11px">${esc(v.euro||'—')}</td>
    </tr>`).join('')}
    ${rows.length>20?`<tr><td colspan="8" style="text-align:center;color:var(--text3);font-size:12px">...i ${rows.length-20} więcej pojazdów</td></tr>`:''}
    </tbody></table></div>
  <div style="display:flex;gap:10px">
    <button class="btn btn-gray" onclick="pendingImport=[];document.getElementById('imp-preview').classList.add('hidden')"><i class="ti ti-x"></i>Anuluj</button>
    <button class="btn btn-amber" onclick="impMerge()"><i class="ti ti-git-merge"></i>Scal z bazą (dodaj nowe, zachowaj istniejące)</button>
    <button class="btn btn-red" onclick="impReplace()"><i class="ti ti-replace"></i>Zastąp całą bazę (${rows.length} poj.)</button>
  </div>`;
  el.scrollIntoView({behavior:'smooth'});
}

function impMerge() {
  let added=0;
  pendingImport.forEach(nv=>{
    const exists=vehs.find(v=>v.nrRej===nv.nrRej);
    if(!exists){vehs.push({...nv,id:vehs.length});added++;}
  });
  document.getElementById('imp-preview').classList.add('hidden');
  renderVeh();updateCounters();
  toast(`✓ Scalono — dodano ${added} nowych pojazdów`);
  window.TaxOrderFleetCloud?.saveVehicles(vehs);
}

function impReplace() {
  vehs.splice(0,vehs.length,...pendingImport.map((v,i)=>({...v,id:i})));
  selected.clear();
  document.getElementById('imp-preview').classList.add('hidden');
  renderVeh();updateCounters();
  toast(`✓ Zastąpiono bazę — ${vehs.length} pojazdów`);
  window.TaxOrderFleetCloud?.saveVehicles(vehs);
}

// --- Eksport Excel ---
function expXlAll() { expXlExport(vehs,'flota_cala'); }
function expXlSel() {
  const sel=getSel();
  if(!sel.length){toast('⚠ Brak zaznaczonych pojazdów');return;}
  expXlExport(sel,'flota_zaznaczone');
}

function expXlExport(list,fname) {
  const taxes=list.map(v=>({...v,...calcTax(v)}));
  const hdrs=['Nr rej.','Marka','Model','Rok','Typ','DMC (kg)','DMC zesp. (kg)','EURO','VIN','Status','Właściciel','Osie','Zawieszenie','Mies. pod.','Kategoria DT-1','Stawka roczna (zł)','Podatek (zł)','I rata (zł)','II rata (zł)','§2 (tak/nie)'];
  const rows=taxes.map(v=>{
    const r1=Math.round((v.amount||0)/2),r2=Math.round(v.amount||0)-r1;
    return [v.nrRej,v.marka,v.model,v.rok,v.typ,v.dmc||v.dmcMax||0,v.dmcZespolu||0,v.euro||'',v.vin||'',v.status,v.wlasciciel,v.osie,v.zawieszenie,v.miesiacePodatku||12,v.cat||'',v.rate||0,Math.round((v.amount||0)*100)/100,r1,r2,(parseInt(v.rok)||0)>=2024?'TAK':'NIE'];
  });
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([hdrs,...rows]);
  ws['!cols']=hdrs.map((_,i)=>({wch:[12,10,18,6,12,10,12,10,20,10,14,6,14,8,12,14,12,12,12,8][i]||12}));
  XLSX.utils.book_append_sheet(wb,ws,'Flota');
  XLSX.writeFile(wb,fname+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
  toast(`✓ Excel pobrany — ${list.length} pojazdów`);
}

// --- Eksport CSV ---
function expCsv() {
  const taxes=vehs.map(v=>({...v,...calcTax(v)}));
  const hdrs=['nrRej','marka','model','rok','typ','dmc','dmcZespolu','euro','vin','status','wlasciciel','osie','zawieszenie','miesiacePodatku','cat','rate','amount'];
  const rows=[hdrs.join(';'),...taxes.map(v=>hdrs.map(k=>String(v[k]||'').replace(/;/g,',')).join(';'))];
  const blob=new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='flota_dt1_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();URL.revokeObjectURL(a.href);
  toast(`✓ CSV pobrany — ${vehs.length} pojazdów`);
}

// --- Eksport JSON backup ---
function expJson() {
  const tpData={};
  ['nip','regon','nazwa','ulica','dom','lokal','kod','miasto','woj','organ','imie','nazwisko','cel'].forEach(k=>{
    const el=document.getElementById('tp-'+k);
    if(el)tpData[k]=el.value;
  });
  const state={
    version:'1.0',ts:new Date().toISOString(),
    vehs:vehs,selected:[...selected],
    taxpayer:tpData,decReason,
    fakHistory:fakHistory,
    taxYear:document.getElementById('taxYear')?.value
  };
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='backup_dt1_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();URL.revokeObjectURL(a.href);
  toast(`✓ Backup zapisany — ${vehs.length} pojazdów, ${selected.size} zaznaczonych`);
}

// ==================== LOGIN SYSTEM ====================
const DEFAULT_USERS = [{id:1,name:'Administrator',email:'adamus1000@gmail.com',passwordHash:btoa('asdasd'),role:'admin',tel:'',active:true},{id:2,name:'Kierownik Floty',email:'kierownik@mtoilet.pl',passwordHash:btoa('kierownik123'),role:'kierownik',tel:'',active:true}];
const ROLE_LABELS = {admin:'Administrator',kierownik:'Kierownik',ksiegowy:'Księgowy',mechanik:'Mechanik',dyspozytor:'Dyspozytor',kierowca:'Kierowca'};
const ROLE_COLORS = {admin:'pill-red',kierownik:'pill-blue',ksiegowy:'pill-green',mechanik:'pill-amber',dyspozytor:'pill-blue',kierowca:'pill-gray'};
const ROLE_TABS = {
  admin:      ['dash','pojazdy','kierowcy','kalendarz','paliwo','kalkulator','formularze','stawki','pd','walidacja','raporty','ocr','faktury','pdfexport','impexp','karty','szkody','opony-magazyn','zlecenia','protokoly','cfm-klienci','cfm-kontrakty','cfm-faktury','uzytkownicy','api-klucze','cepik','podatnik','firmy','ai','powiadomienia','mandaty','alert-dashboard','terminarz','polisy-ocr','dr-import','mapa','dt1-historia','webhooks','errors-admin'],
  kierownik:  ['dash','pojazdy','kierowcy','kalendarz','paliwo','kalkulator','formularze','stawki','raporty','pdfexport','ocr','faktury','karty','szkody','opony-magazyn','zlecenia','protokoly','cfm-klienci','cfm-kontrakty','cfm-faktury','ai','powiadomienia','mandaty','alert-dashboard','terminarz','polisy-ocr','dr-import','mapa','dt1-historia','webhooks'],
  ksiegowy:   ['dash','paliwo','kalkulator','formularze','stawki','pd','raporty','pdfexport','impexp','podatnik','ai','powiadomienia','mandaty'],
  mechanik:   ['dash','pojazdy','paliwo','ocr','faktury','szkody','opony-magazyn','zlecenia','protokoly','powiadomienia'],
  dyspozytor: ['dash','pojazdy','kierowcy','kalendarz','paliwo','raporty','karty','ocr','faktury','szkody','opony-magazyn','zlecenia','protokoly','powiadomienia','mandaty','alert-dashboard','mapa'],
  kierowca:   ['dash','pojazdy','paliwo','kalendarz','powiadomienia'],
};
let users = JSON.parse(localStorage.getItem('dt1_users')||JSON.stringify(DEFAULT_USERS));
let currentUser = null;
let editUserId = null;

function saveUsers(){localStorage.setItem('dt1_users',JSON.stringify(users));}

async function doLogin(){
  const email=(document.getElementById('login-email')?.value||'').trim().toLowerCase();
  const pass=document.getElementById('login-pass')?.value||'';

  if(!email||!pass){
    showLoginErr('Wpisz e-mail i hasło');
    return;
  }

  let supabaseUser = null;

  if(window.TaxOrderAuth && typeof window.TaxOrderAuth.login === 'function'){
    const authResult = await window.TaxOrderAuth.login(email, pass);

    if(!authResult.ok){
      showLoginErr('Błąd logowania: ' + (authResult.error?.message || 'brak sesji'));
      return;
    }

    supabaseUser = authResult.user;
  }

  let u;
  if(supabaseUser){
    // Backend (D1/Worker) jest jedynym autorytatywnym źródłem roli — NIE nadpisuj jej
    // lokalną listą `users` (localStorage, pozostałość po migracji z Supabase) ani domyślną wartością.
    u = {
      id: supabaseUser.id,
      email: supabaseUser.email || email,
      name: supabaseUser.name || supabaseUser.user_metadata?.name || email,
      role: supabaseUser.role || 'kierowca',
      active: true
    };
  } else {
    // Tryb offline (brak skonfigurowanego backendu) — lokalna lista users jako jedyny fallback
    u = users.find(x => x.email.toLowerCase() === email && x.active);
    if(!u){
      u = { id: email, email, name: email, role: 'kierowca', active: true };
    }
  }

  currentUser=u;
  window.currentUserId = u.id || null;

  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('user-avatar').textContent=u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('user-name').textContent=u.name;
  document.getElementById('user-role-lbl').textContent=ROLE_LABELS[u.role]||u.role;

  applyRoleAccess(u.role);
  sessionStorage.setItem('dt1_user_email',u.email);

  if(typeof loadCompanyState==='function'){
    loadCompanyState(currentCompanyId);
    updateCompanyUI();
  }

  if(window.TaxOrderFleetCloud && typeof window.TaxOrderFleetCloud.loadVehicles === 'function'){
    try {
      await window.TaxOrderFleetCloud.loadVehicles();
    } catch(e) {
      console.warn('[FleetCloud] Błąd ładowania pojazdów po logowaniu — używam lokalnej floty:', e.message);
    }

    if(typeof refreshAll==='function') refreshAll();

    // Subskrybuj zmiany real-time po zalogowaniu
    window.TaxOrderFleetCloud?.subscribeRealTime?.(currentCompanyId);

    console.log('[FleetCloud] Automatycznie zaladowano pojazdy po zalogowaniu');
  }

  renderDash();
  renderVeh();
  updateCounters();

  setTimeout(() => {
    if (window.TaxOrderNotifications?.requestAndCheck) {
      window.TaxOrderNotifications.requestAndCheck();
      window.TaxOrderNotifications.updateBadge?.();
      window.TaxOrderNotifications.startAutoCheck?.();
    }
  }, 3000);

  // Deep link: ?veh=WGM87205 otwiera kartę pojazdu
  setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    const deepVeh = params.get('veh');
    if (deepVeh) {
      const v = vehs.find(x => (x.nr_rej||x.nrRej||'').toUpperCase() === deepVeh.toUpperCase());
      if (v) {
        showPage('pojazdy');
        setTimeout(() => TaxOrderVehicleDetail?.open?.(v.id), 300);
      }
    }
  }, 1000);
}

function showLoginErr(msg){
  const el=document.getElementById('login-err');
  if(el){el.style.display='flex';el.innerHTML=`<i class="ti ti-alert-circle"></i>${esc(String(msg||''))}`;}
}
  
async function resetPasswordFlow(){
  const email=(document.getElementById('login-email')?.value||'').trim().toLowerCase();

  if(!email){
    showLoginErr('Najpierw wpisz adres e-mail.');
    return;
  }

  if(!window.TaxOrderAuth || typeof window.TaxOrderAuth.resetPassword !== 'function'){
    showLoginErr('Reset hasła nie jest jeszcze dostępny.');
    return;
  }

  const result = await window.TaxOrderAuth.resetPassword(email);

  if(!result.ok){
    showLoginErr('Nie udało się wysłać linku resetującego: ' + (result.error?.message || 'błąd'));
    return;
  }

  showLoginErr('Wysłano link do ustawienia nowego hasła na adres: ' + email);
}

function showNewPasswordModal() {
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) loginScreen.style.display = 'none';
  const modal = document.getElementById('pwd-reset-modal');
  if (!modal) { _showNewPasswordFallback(); return; }
  modal.style.display = 'flex';
  const np = document.getElementById('pwd-new');
  const cp = document.getElementById('pwd-confirm');
  const errEl = document.getElementById('pwd-reset-err');
  if (np) np.value = '';
  if (cp) cp.value = '';
  if (errEl) errEl.style.display = 'none';
  [np, cp].forEach(el => { if (el) el.onkeydown = (e) => { if (e.key === 'Enter') submitNewPassword(); }; });
  if (np) setTimeout(() => np.focus(), 100);
}

async function submitNewPassword() {
  const newPassword = (document.getElementById('pwd-new')?.value || '').trim();
  const confirm = (document.getElementById('pwd-confirm')?.value || '').trim();
  const errEl = document.getElementById('pwd-reset-err');
  const btn = document.getElementById('pwd-reset-submit');
  const showErr = (msg) => {
    if (errEl) { errEl.style.display = 'flex'; errEl.innerHTML = '<i class="ti ti-alert-circle"></i>' + esc(msg); }
  };
  if (!newPassword || newPassword.length < 6) { showErr('Hasło musi mieć minimum 6 znaków.'); return; }
  if (newPassword !== confirm) { showErr('Hasła nie są takie same.'); return; }
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>Zmieniam hasło...'; }
  if (errEl) errEl.style.display = 'none';
  try {
    if (window.TaxOrderAuth?.updatePassword) {
      const result = await window.TaxOrderAuth.updatePassword(newPassword);
      if (!result.ok) throw new Error(result.error?.message || 'błąd');
    } else if (window.supabaseClient?.auth?.updateUser) {
      const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
      if (error) throw error;
    } else {
      throw new Error('Brak metody aktualizacji hasła');
    }
    const modal = document.getElementById('pwd-reset-modal');
    if (modal) modal.style.display = 'none';
    toast('✅ Hasło zostało zmienione — możesz się zalogować');
    if (window.supabaseClient?.auth?.signOut) await window.supabaseClient.auth.signOut();
    const loginScreenEl = document.getElementById('login-screen');
    if (loginScreenEl) loginScreenEl.style.display = 'flex';
    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = 'none';
    showLoginErr('✅ Hasło zostało zmienione. Zaloguj się nowym hasłem.');
  } catch (err) {
    showErr('Nie udało się zmienić hasła: ' + (err.message || 'błąd'));
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-check"></i>Ustaw nowe hasło'; }
  }
}

async function _showNewPasswordFallback() {
  const newPassword = prompt('Wpisz nowe hasło (min. 6 znaków):');
  if (!newPassword || newPassword.length < 6) { alert('Hasło musi mieć minimum 6 znaków.'); return; }
  try {
    if (window.supabaseClient?.auth?.updateUser) {
      const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
      if (error) throw error;
    }
    alert('Hasło zostało zmienione. Zaloguj się nowym hasłem.');
    await window.supabaseClient?.auth?.signOut?.();
  } catch (err) { alert('Błąd: ' + err.message); }
}

function isPasswordRecoveryUrl() {
  const h = window.location.hash || '';
  const q = window.location.search || '';
  return (
    h.includes('type=recovery') ||
    q.includes('type=recovery') ||
    h.includes('access_token=') ||
    q.includes('code=')
  );
}

async function handlePasswordRecoveryUrl() {
  if (!isPasswordRecoveryUrl()) return;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && window.supabaseClient?.auth?.exchangeCodeForSession) {
      const { error } = await window.supabaseClient.auth.exchangeCodeForSession(code);
      if (error) console.error('[PasswordRecovery] exchangeCodeForSession error:', error.message);
    }
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');
    if (accessToken && type === 'recovery' && window.supabaseClient?.auth?.setSession) {
      await window.supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || ''
      });
    }
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    showNewPasswordModal();
  } catch (e) {
    console.error('[PasswordRecovery] Błąd:', e);
    showNewPasswordModal();
  }
}

if (window.supabaseClient) {
  window.supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      console.log('[Auth] PASSWORD_RECOVERY event received');
      showNewPasswordModal();
    }
  });
  window.addEventListener('load', () => {
    setTimeout(() => { handlePasswordRecoveryUrl(); }, 800);
  });
}

function doLogout(){
  currentUser=null;
  sessionStorage.removeItem('dt1_user_email');
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-pass').value='';
  document.getElementById('login-err').style.display='none';
}

function applyRoleAccess(role){
  const allowed=ROLE_TABS[role]||ROLE_TABS.mechanik;
  document.querySelectorAll('.tnb').forEach(btn=>{
    const id=btn.id.replace('tnb-','');
    btn.style.display=(role==='admin'||allowed.includes(id))?'':'none';
  });

  // Rola Kierowca — widzi tylko swój pojazd
  if (role === 'kierowca' && currentUser) {
    const driverName = currentUser.name;
    const myVehs = (window.vehs||[]).filter(v => v.kierowca === driverName);
    if (myVehs.length) {
      // Nie nadpisuj globalnego vehs — zamiast tego ustaw filtr
      window._driverFilter = driverName;
    } else {
      window._driverFilter = driverName; // pokaże pustą listę jeśli nie ma przypisanego pojazdu
    }
  } else {
    window._driverFilter = null;
  }
}

// --- Users CRUD ---
function renderUsers(){
  const tbody=document.getElementById('users-tbody');
  if(!tbody)return;
  tbody.innerHTML=users.map(u=>`<tr>
    <td>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:30px;height:30px;border-radius:50%;background:var(--blue-light);color:var(--blue);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
        <div><div style="font-weight:500">${u.name}</div>${u.tel?`<div style="font-size:11px;color:var(--text3)">${u.tel}</div>`:''}</div>
      </div>
    </td>
    <td style="font-family:var(--mono);font-size:12px">${u.email}</td>
    <td><span class="pill ${ROLE_COLORS[u.role]||'pill-gray'}">${ROLE_LABELS[u.role]||u.role}</span></td>
    <td style="font-size:11px;color:var(--text2)">${(ROLE_TABS[u.role]||[]).slice(0,4).join(', ')}${(ROLE_TABS[u.role]||[]).length>4?'...':''}</td>
    <td><span class="pill ${u.active?'pill-green':'pill-red'}">${u.active?'Aktywny':'Nieaktywny'}</span></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="tbtn" onclick="openUserModal(${u.id})"><i class="ti ti-edit"></i>Edytuj</button>
        ${u.id!==1?`<button class="tbtn" onclick="toggleUser(${u.id})" style="${u.active?'color:var(--red)':'color:var(--green)'}"><i class="ti ti-${u.active?'user-off':'user-check'}"></i>${u.active?'Blokuj':'Aktywuj'}</button>`:''}
        ${currentUser?.role==='admin'&&u.id!==currentUser.id&&u.id!==1?`<button class="tbtn" onclick="deleteUser(${u.id})" style="color:var(--red)"><i class="ti ti-trash"></i></button>`:''}
      </div>
    </td>
  </tr>`).join('');
}

function openUserModal(id){
  editUserId=id||null;
  const u=id?users.find(x=>x.id===id):null;
  document.getElementById('um-title').textContent=u?'Edytuj użytkownika':'Dodaj użytkownika';
  document.getElementById('um-name').value=u?.name||'';
  document.getElementById('um-email').value=u?.email||'';
  document.getElementById('um-pass').value='';
  document.getElementById('um-pass').placeholder=u?'Zostaw puste = bez zmiany hasła':'Min. 6 znaków';
  document.getElementById('um-role').value=u?.role||'mechanik';
  document.getElementById('um-tel').value=u?.tel||'';
  document.getElementById('user-modal').classList.remove('hidden');
}

function saveUser(){
  const name=document.getElementById('um-name').value.trim();
  const email=document.getElementById('um-email').value.trim().toLowerCase();
  const pass=document.getElementById('um-pass').value;
  const role=document.getElementById('um-role').value;
  const tel=document.getElementById('um-tel').value.trim();
  if(!name||!email){toast('⚠ Wpisz imię i e-mail');return;}
  if(!editUserId&&pass.length<6){toast('⚠ Hasło min. 6 znaków');return;}
  if(editUserId){
    const u=users.find(x=>x.id===editUserId);
    if(u){u.name=name;u.email=email;u.role=role;u.tel=tel;if(pass.length>=6)u.passwordHash=btoa(pass);}
  }else{
    if(users.find(x=>x.email===email)){toast('⚠ E-mail już istnieje');return;}
    users.push({id:Date.now(),name,email,passwordHash:btoa(pass),role,tel,active:true});
  }
  saveUsers();
  document.getElementById('user-modal').classList.add('hidden');
  renderUsers();
  toast(`✓ ${editUserId?'Zaktualizowano':'Dodano'}: ${name}`);
  editUserId=null;
}

function toggleUser(id){
  const u=users.find(x=>x.id===id);
  if(u){u.active=!u.active;saveUsers();renderUsers();toast(`${u.active?'✓ Aktywowano':'⚠ Zablokowano'}: ${u.name}`);}
}
function deleteUser(id){
  if(!confirm('Usunąć użytkownika?'))return;
  users=users.filter(x=>x.id!==id);saveUsers();renderUsers();toast('✓ Użytkownik usunięty');
}

// ==================== AUDIT LOG ====================
function showAuditLog() {
  const log = JSON.parse(localStorage.getItem('auditLog')||'[]').reverse().slice(0,200);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
  const ACTION_LABEL = {save:'Zapis danych',inspection_add:'Dodał wpis SKP',inspection_remove:'Usunął wpis SKP',udt_add:'Dodał wpis UDT',udt_remove:'Usunął wpis UDT',tacho_add:'Dodał wpis tacho',tacho_remove:'Usunął wpis tacho',card_add:'Dodał kartę flotową',card_remove:'Usunął kartę flotową'};
  overlay.innerHTML = `
    <div style="background:var(--bg2);border-radius:var(--radius-lg);width:700px;max-width:98vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.3)">
      <div style="padding:18px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <i class="ti ti-history" style="color:var(--blue);font-size:20px"></i>
        <span style="font-size:16px;font-weight:600">Dziennik zmian (audit log)</span>
        <button onclick="this.closest('[style*=fixed]').remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:18px;color:var(--text3)">&times;</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:16px">
        ${!log.length ? '<div style="text-align:center;padding:30px;color:var(--text3)">Brak wpisów w dzienniku</div>' :
          '<table style="width:100%;font-size:11px;border-collapse:collapse">' +
          '<thead><tr><th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)">Kiedy</th><th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)">Kto</th><th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)">Akcja</th><th style="text-align:left;padding:4px 6px;border-bottom:1px solid var(--border)">Pojazd</th></tr></thead><tbody>' +
          log.map(e => {
            const veh = e.vehId != null ? (vehs.find(v=>v.id===e.vehId)?.nrRej || 'id:'+e.vehId) : (e.changes?.nrRej || '—');
            return `<tr style="border-bottom:0.5px solid var(--border)">
              <td style="padding:4px 6px;font-family:var(--mono);white-space:nowrap">${e.ts ? new Date(e.ts).toLocaleString('pl-PL') : '—'}</td>
              <td style="padding:4px 6px">${e.user||'—'}</td>
              <td style="padding:4px 6px">${ACTION_LABEL[e.action]||e.action||'—'}</td>
              <td style="padding:4px 6px;font-family:var(--mono)">${veh}</td>
            </tr>`;
          }).join('') + '</tbody></table>'}
      </div>
      <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-gray" style="font-size:11px" onclick="if(confirm('Wyczyścić dziennik?')){localStorage.removeItem('auditLog');this.closest('[style*=fixed]').remove();toast('Dziennik wyczyszczony')}">
          <i class="ti ti-trash"></i>Wyczyść dziennik
        </button>
        <button class="btn btn-gray" onclick="this.closest('[style*=fixed]').remove()">Zamknij</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// ==================== KARTY FLOTOWE (D1) ====================
let _cards = [];
let _cardsLoaded = false;
let editKartaId = null;
window.getFlotCards = () => _cards;

function _cfApi() { return window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'; }
function _cfHdrs(extra) {
  const t = localStorage.getItem('cf_token');
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(extra || {}) };
}
function _cfCo() { return window.currentCompanyId || 'mtoilet'; }

async function _migrateKartyLocalStorage() {
  const raw = localStorage.getItem('dt1_karty');
  if (!raw) return;
  let old; try { old = JSON.parse(raw); } catch { localStorage.removeItem('dt1_karty'); return; }
  if (!Array.isArray(old) || !old.length) { localStorage.removeItem('dt1_karty'); return; }
  let migrated = 0;
  for (const k of old) {
    if (!k.nr) continue;
    try {
      const r = await fetch(`${_cfApi()}/api/fleet-cards?company=${_cfCo()}`, {
        method: 'POST', headers: _cfHdrs(),
        body: JSON.stringify({ card_no:k.nr, pin:k.pin||null, nr_rej:k.nrRej||null, type:k.typ||'PALIWOWA',
          provider:k.dostawca||null, limit_pln:k.limit||null, expires:k.wazna||null,
          status:k.status||'AKTYWNA', notes:k.uwagi||null }),
      });
      if (r.ok) migrated++;
    } catch {}
  }
  if (migrated > 0) { localStorage.removeItem('dt1_karty'); toast(`✓ Przeniesiono ${migrated} kart flotowych do chmury`); }
}

async function _loadKarty() {
  try {
    await _migrateKartyLocalStorage();
    const r = await fetch(`${_cfApi()}/api/fleet-cards?company=${_cfCo()}`, { headers: _cfHdrs() });
    const d = r.ok ? await r.json() : {};
    _cards = d.cards || [];
    _cardsLoaded = true;
  } catch { _cards = []; }
}

function renderKarty() {
  const tbody = document.getElementById('karty-tbody');
  if (!tbody) return;
  if (!_cardsLoaded) { _loadKarty().then(() => renderKarty()); return; }
  const q = (document.getElementById('kf-search')?.value || '').toLowerCase();
  const typ = document.getElementById('kf-typ')?.value || '';
  const list = _cards.filter(k =>
    (!q || (k.card_no||'').toLowerCase().includes(q) || (k.nr_rej||'').toLowerCase().includes(q) || (k.provider||'').toLowerCase().includes(q)) &&
    (!typ || k.type === typ)
  );
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:var(--text3)"><i class="ti ti-credit-card" style="font-size:32px;display:block;margin-bottom:8px"></i>Brak kart flotowych — kliknij Dodaj kartę</td></tr>`;
    updateKartySummary(); return;
  }
  const TYPE_COLORS = { PALIWOWA:'pill-blue', 'OPŁATY':'pill-amber', PARKING:'pill-green', INNA:'pill-gray' };
  const STATUS_COLORS = { AKTYWNA:'pill-green', ZABLOKOWANA:'pill-red', NIEAKTYWNA:'pill-gray' };
  tbody.innerHTML = list.map(k => `<tr>
    <td style="font-family:var(--mono);font-size:12px;font-weight:600">${esc(maskCard(k.card_no))}</td>
    <td>
      <div style="display:flex;align-items:center;gap:6px">
        <span id="pin-${k.id}" style="font-family:var(--mono);letter-spacing:2px">••••</span>
        <button class="tbtn" style="padding:3px 8px;font-size:10px" data-id="${esc(k.id)}" data-pin="${esc(k.pin||'')}" onclick="togglePin(this.dataset.id,this.dataset.pin)">Pokaż</button>
      </div>
    </td>
    <td><strong style="font-family:var(--mono)">${esc(k.nr_rej||'—')}</strong></td>
    <td><span class="pill ${TYPE_COLORS[k.type]||'pill-gray'}">${esc(k.type)}</span></td>
    <td>${esc(k.provider||'—')}</td>
    <td style="font-family:var(--mono)">${k.limit_pln ? Number(k.limit_pln).toLocaleString('pl-PL')+' zł' : '—'}</td>
    <td style="font-size:12px">${k.expires||'—'}</td>
    <td><span class="pill ${STATUS_COLORS[k.status]||'pill-gray'}">${esc(k.status)}</span></td>
    <td>
      <div style="display:flex;gap:4px">
        <button class="tbtn" data-id="${esc(k.id)}" onclick="openKartaModal(this.dataset.id)"><i class="ti ti-edit"></i></button>
        <button class="tbtn" data-id="${esc(k.id)}" onclick="deleteKarta(this.dataset.id)" style="color:var(--red)"><i class="ti ti-trash"></i></button>
      </div>
    </td>
  </tr>`).join('');
  updateKartySummary();
}

function maskCard(nr) { return (nr||'').replace(/\d(?=\d{4})/g, '•').replace(/(.{4})/g, '$1 ').trim(); }

function togglePin(id, pin) {
  const el = document.getElementById('pin-' + id);
  if (!el) return;
  if (el.textContent === '••••') { el.textContent = pin || '????'; el.nextElementSibling.textContent = 'Ukryj'; }
  else { el.textContent = '••••'; el.nextElementSibling.textContent = 'Pokaż'; }
}

function updateKartySummary() {
  const el = document.getElementById('karty-summary'); if (!el) return;
  if (!_cards.length) { el.innerHTML = '<span style="color:var(--text3)">Brak kart</span>'; return; }
  const byTyp = {}; _cards.forEach(k => { if (!byTyp[k.type]) byTyp[k.type] = 0; byTyp[k.type]++; });
  const aktywne = _cards.filter(k => k.status === 'AKTYWNA').length;
  el.innerHTML = `<div class="sum-row"><span>Kart łącznie</span><span class="sum-val">${_cards.length}</span></div>
    <div class="sum-row"><span>Aktywnych</span><span class="sum-val green">${aktywne}</span></div>
    ${Object.entries(byTyp).map(([t, n]) => `<div class="sum-row"><span>${t}</span><span class="sum-val">${n}</span></div>`).join('')}`;
}

function openKartaModal(id) {
  editKartaId = id || null;
  const k = id ? _cards.find(x => x.id === id) : null;
  document.getElementById('km-title').textContent = k ? 'Edytuj kartę' : 'Dodaj kartę flotową';
  document.getElementById('km-nr').value      = k?.card_no  || '';
  document.getElementById('km-pin').value     = k?.pin      || '';
  document.getElementById('km-nrrej').value   = k?.nr_rej   || '';
  document.getElementById('km-typ').value     = k?.type     || 'PALIWOWA';
  document.getElementById('km-dostawca').value= k?.provider || '';
  document.getElementById('km-limit').value   = k?.limit_pln|| '';
  document.getElementById('km-wazna').value   = k?.expires  || '';
  document.getElementById('km-status').value  = k?.status   || 'AKTYWNA';
  document.getElementById('km-uwagi').value   = k?.notes    || '';
  const dl = document.getElementById('km-veh-list');
  if (dl) dl.innerHTML = vehs.map(v => `<option value="${esc(v.nrRej)}">${esc(v.nrRej)} — ${esc(v.marka)} ${esc(v.model)}</option>`).join('');
  document.getElementById('karta-modal').classList.remove('hidden');
}

async function saveKarta() {
  const nr = document.getElementById('km-nr').value.trim();
  if (!nr) { toast('⚠ Wpisz numer karty'); return; }
  const body = {
    card_no:   nr,
    pin:       document.getElementById('km-pin').value.trim() || null,
    nr_rej:    document.getElementById('km-nrrej').value.trim().toUpperCase() || null,
    type:      document.getElementById('km-typ').value,
    provider:  document.getElementById('km-dostawca').value.trim() || null,
    limit_pln: parseFloat(document.getElementById('km-limit').value) || null,
    expires:   document.getElementById('km-wazna').value.trim() || null,
    status:    document.getElementById('km-status').value,
    notes:     document.getElementById('km-uwagi').value.trim() || null,
  };
  try {
    let r;
    if (editKartaId) {
      r = await fetch(`${_cfApi()}/api/fleet-cards/${editKartaId}?company=${_cfCo()}`, {
        method: 'PUT', headers: _cfHdrs(), body: JSON.stringify(body),
      });
    } else {
      r = await fetch(`${_cfApi()}/api/fleet-cards?company=${_cfCo()}`, {
        method: 'POST', headers: _cfHdrs(), body: JSON.stringify(body),
      });
    }
    if (!r.ok) { const e = await r.json().catch(() => ({})); toast('⚠ ' + (e.error || 'Błąd: ' + r.status)); return; }
    await _loadKarty();
    document.getElementById('karta-modal').classList.add('hidden');
    renderKarty(); toast(`✓ Karta ${nr} zapisana`); editKartaId = null;
    // Odśwież listę kart w otwartej karcie pojazdu
    const vdNrRej = document.getElementById('km-nrrej')?.value || body.nr_rej;
    if (vdNrRej) {
      const v = (window.vehs||[]).find(x => x.nrRej === vdNrRej);
      const cardList = document.getElementById('vd-cards-list');
      if (cardList && v && window.TaxOrderVehicleDetail) cardList.innerHTML = window.TaxOrderVehicleDetail._renderCards(v);
    }
  } catch { toast('⚠ Błąd połączenia'); }
}

async function deleteKarta(id) {
  if (!confirm('Usunąć kartę?')) return;
  try {
    const r = await fetch(`${_cfApi()}/api/fleet-cards/${id}?company=${_cfCo()}`, { method: 'DELETE', headers: _cfHdrs() });
    if (!r.ok) { toast('⚠ Błąd usuwania: ' + r.status); return; }
    await _loadKarty(); renderKarty(); toast('✓ Karta usunięta');
  } catch { toast('⚠ Błąd połączenia'); }
}

async function importKarty(inp) {
  if (!inp.files[0]) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      let added = 0;
      for (const r of rows) {
        const nr = String(r['Nr karty']||r['nr karty']||r['number']||'').trim();
        if (!nr) continue;
        const body = {
          card_no:   nr,
          pin:       String(r['PIN']||r['pin']||'').trim() || null,
          nr_rej:    String(r['Nr rej']||r['nr rej']||r['nrRej']||'').trim().toUpperCase() || null,
          type:      String(r['Typ']||r['typ']||'PALIWOWA').trim().toUpperCase(),
          provider:  String(r['Dostawca']||r['dostawca']||'').trim() || null,
          limit_pln: parseFloat(r['Limit']||r['limit']||'') || null,
          expires:   String(r['Ważna do']||r['wazna']||'').trim() || null,
          status:    String(r['Status']||r['status']||'AKTYWNA').trim().toUpperCase(),
          notes:     String(r['Uwagi']||r['uwagi']||'').trim() || null,
        };
        const res = await fetch(`${_cfApi()}/api/fleet-cards?company=${_cfCo()}`, {
          method: 'POST', headers: _cfHdrs(), body: JSON.stringify(body),
        });
        if (res.ok) added++;
      }
      await _loadKarty(); renderKarty(); toast(`✓ Zaimportowano ${added} kart`);
    } catch (err) { toast('⚠ Błąd importu: ' + err.message); }
  };
  reader.readAsArrayBuffer(inp.files[0]);
}

function exportKarty() {
  if (!_cards.length) { toast('⚠ Brak kart do eksportu'); return; }
  const hdrs = ['Nr karty','PIN','Nr rej.','Typ','Dostawca','Limit (zł)','Ważna do','Status','Uwagi'];
  const rows = _cards.map(k => [k.card_no, k.pin, k.nr_rej, k.type, k.provider, k.limit_pln, k.expires, k.status, k.notes]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([hdrs, ...rows]);
  ws['!cols'] = [{wch:20},{wch:8},{wch:12},{wch:12},{wch:12},{wch:10},{wch:10},{wch:12},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, 'Karty Flotowe');
  XLSX.writeFile(wb, 'karty_flotowe_' + new Date().toISOString().slice(0,10) + '.xlsx');
  toast(`✓ Eksport ${_cards.length} kart`);
}

// ==================== DOKUMENTY POJAZDÓW (Dowody rej.) ====================
let docStore={};  // {nrRej: [{id, name, type, data, uploadedAt}]}
let currentDocNrRej=null;

function getDocIcon(nrRej){
  const docs=docStore[nrRej]||[];
  if(!docs.length) return `<button class="tbtn" style="padding:3px 8px;font-size:10px;color:var(--text3)" title="Dodaj dokument" data-nr="${esc(nrRej)}" onclick="event.stopPropagation();triggerDocUpload(this.dataset.nr)"><i class="ti ti-upload"></i></button>`;
  return `<button class="tbtn" style="padding:3px 8px;font-size:10px;color:var(--blue)" title="${docs.length} dok." data-nr="${esc(nrRej)}" onclick="event.stopPropagation();openDocModal(this.dataset.nr)"><i class="ti ti-file-description"></i> ${docs.length}</button>`;
}

function triggerDocUpload(nrRej){
  currentDocNrRej=nrRej;
  const inp=document.getElementById('doc-file-inp')||createDocInput();
  inp.click();
}

function createDocInput(){
  const inp=document.createElement('input');
  inp.type='file';inp.id='doc-file-inp';inp.accept='image/*,.pdf';inp.style.display='none';
  inp.addEventListener('change',()=>handleDocUpload(inp));
  document.body.appendChild(inp);
  return inp;
}

function handleDocUpload(inp){
  const f=inp.files[0];if(!f||!currentDocNrRej)return;
  if(f.size>5*1024*1024){toast('⚠ Plik za duży — maks. 5 MB dla dokumentów');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const doc={id:'doc'+Date.now(),name:f.name,type:f.type,data:e.target.result,uploadedAt:new Date().toLocaleString('pl-PL'),nrRej:currentDocNrRej};
    if(!docStore[currentDocNrRej])docStore[currentDocNrRej]=[];
    docStore[currentDocNrRej].push(doc);
    renderVeh();
    toast(`✓ Dodano dokument dla ${currentDocNrRej}: ${f.name}`);
    openDocModal(currentDocNrRej);
  };
  reader.readAsDataURL(f);
  inp.value='';
}

function openDocModal(nrRej){
  currentDocNrRej=nrRej;
  const docs=docStore[nrRej]||[];
  const v=vehs.find(x=>x.nrRej===nrRej);
  document.getElementById('doc-modal-title').textContent=`Dokumenty: ${nrRej}`;
  document.getElementById('doc-modal-sub').textContent=v?`${v.marka} ${v.model} · ${docs.length} dok.`:`${docs.length} dokumentów`;

  if(!docs.length){
    document.getElementById('doc-modal-body').innerHTML=`<div style="text-align:center;padding:3rem;color:var(--text3)">
      <i class="ti ti-file-off" style="font-size:48px;display:block;margin-bottom:12px"></i>
      <div style="margin-bottom:14px">Brak dokumentów dla ${esc(nrRej)}</div>
      <button class="btn btn-blue" data-nr="${esc(nrRej)}" onclick="triggerDocUpload(this.dataset.nr)"><i class="ti ti-upload"></i>Wgraj dowód rejestracyjny</button>
    </div>`;
  }else{
    document.getElementById('doc-modal-body').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        ${docs.map(d=>`<div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
          ${d.type.startsWith('image/')?
            `<img src="${d.data}" style="width:100%;max-height:280px;object-fit:contain;background:#f0f0f0;display:block">`:
            `<div style="background:#f5f5f4;height:200px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px">
              <i class="ti ti-file-type-pdf" style="font-size:48px;color:var(--red)"></i>
              <div style="font-size:12px;color:var(--text2)">${esc(d.name)}</div>
              <a href="${d.data}" target="_blank" class="btn btn-gray" style="font-size:11px"><i class="ti ti-external-link"></i>Otwórz PDF</a>
            </div>`}
          <div style="padding:10px 12px">
            <div style="font-weight:500;font-size:12px;margin-bottom:2px">${esc(d.name)}</div>
            <div style="font-size:11px;color:var(--text3)">${esc(d.uploadedAt||'')}</div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <a href="${d.data}" download="${esc(d.name)}" class="btn btn-gray" style="font-size:11px;flex:1;justify-content:center"><i class="ti ti-download"></i>Pobierz</a>
              <button class="btn btn-gray" style="font-size:11px;color:var(--blue)" data-id="${esc(d.id)}" data-nr="${esc(nrRej)}" onclick="runOcrOnDoc(this.dataset.id,this.dataset.nr)"><i class="ti ti-scan"></i>OCR</button>
              <button class="btn btn-gray" style="font-size:11px;color:var(--red)" data-nr="${esc(nrRej)}" data-id="${esc(d.id)}" onclick="deleteDoc(this.dataset.nr,this.dataset.id)"><i class="ti ti-trash"></i></button>
            </div>
          </div>
        </div>`).join('')}
      </div>
      <button class="btn btn-blue" data-nr="${esc(nrRej)}" onclick="triggerDocUpload(this.dataset.nr)"><i class="ti ti-upload"></i>Dodaj kolejny dokument</button>`;
  }
  document.getElementById('doc-modal').classList.remove('hidden');
}

function deleteDoc(nrRej,docId){
  if(!docStore[nrRej])return;
  docStore[nrRej]=docStore[nrRej].filter(d=>d.id!==docId);
  openDocModal(nrRej);renderVeh();toast('✓ Dokument usunięty');
}

async function runOcrOnDoc(docId,nrRej){
  const doc=(docStore[nrRej]||[]).find(d=>d.id===docId);
  if(!doc){toast('⚠ Dokument nie znaleziony');return;}
  document.getElementById('doc-modal').classList.add('hidden');
  showPage('ocr');
  // Załaduj dokument do OCR
  ocrBase64=doc.data.split(',')[1];
  ocrMime=doc.type;
  toast('⏳ Uruchamiam OCR na dokumencie '+doc.name+'...');
  await new Promise(r=>setTimeout(r,300));
  document.getElementById('ocr-img').src=doc.data;
  document.getElementById('ocr-img').style.display=doc.type.startsWith('image/')?'block':'none';
  document.getElementById('ocr-preview').classList.remove('hidden');
  document.getElementById('ocr-btn-area').classList.remove('hidden');
  await runOCR();
}

// ==================== HOOK do renderVeh — dodaj kolumnę dokumentów ====================
const _origRenderVeh = renderVeh;
function renderVehWithDocs(){
  // Wywołaj oryginał (renderuje tbody)
  _origRenderVeh();
  // Dodaj kolumnę dokumentów do każdego wiersza
  const tbody=document.getElementById('veh-tbody');
  if(!tbody)return;
  const rows=tbody.querySelectorAll('tr');
  const filteredVehs=filterVeh();
  rows.forEach((row,i)=>{
    const v=filteredVehs[i];if(!v)return;
    const td=document.createElement('td');
    td.style.textAlign='center';
    td.innerHTML=getDocIcon(v.nrRej);
    row.appendChild(td);
  });
}
// Zastąp renderVeh
window.renderVeh=renderVehWithDocs;


// ==================== FIRMY (Multi-Firma) ====================
let COMPANIES = {
  mtoilet:{id:'mtoilet',shortName:'mToilet',name:'MTOILET SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',nip:'5361938486',regon:'367263453',krs:'0000766937',ulica:'TORUŃSKA',dom:'31',lokal:'',kod:'03-226',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy — Dzielnica Białołęka',color:'#185FA5',wlasciciel:'mToilet'},
  gcon:{id:'gcon',shortName:'G-CON',name:'G-CON SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',nip:'5223036167',regon:'362307353',krs:'0000572114',ulica:'EUGENIUSZA BOCHEŃSKIEGO "DUBAŃCA"',dom:'6',lokal:'',kod:'04-478',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy — Dzielnica Rembertów',color:'#3B6D11',wlasciciel:'GCON'},
  grental:{id:'grental',shortName:'G-Rental',name:'G-RENTAL SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',nip:'9522192210',regon:'381803583',krs:'0000765416',ulica:'EUGENIUSZA BOCHEŃSKIEGO "DUBAŃCA"',dom:'6',lokal:'',kod:'04-478',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy — Dzielnica Rembertów',color:'#BA7517',wlasciciel:'GRENTAL'},
  kjrsupply:{id:'kjrsupply',shortName:'KJR Supply',name:'KJR SUPPLY SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',nip:'5223116423',regon:'369535413',krs:'0000722764',ulica:'MAGENTA',dom:'142',lokal:'',kod:'04-429',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy — Dzielnica Wawer',color:'#7C3AED',wlasciciel:'KJR Supply'},
  nwkinvest:{id:'nwkinvest',shortName:'NWK Invest',name:'NWK INVEST SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',nip:'5361920285',regon:'362208763',krs:'0000573479',ulica:'MACIEJKI',dom:'3',lokal:'',kod:'05-140',miasto:'JACHRANKA',woj:'MAZOWIECKIE',organ:'Burmistrz Gminy Serock',color:'#A32D2D',wlasciciel:'NWK Invest'},
  wolund:{id:'wolund',shortName:'Wolund',name:'WOLUND SYNERGY SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',nip:'5253006751',regon:'',krs:'0001111249',ulica:'ADAMA MICKIEWICZA',dom:'37',lokal:'58',kod:'01-625',miasto:'WARSZAWA',woj:'MAZOWIECKIE',organ:'Prezydent m.st. Warszawy — Dzielnica Żoliborz',color:'#0891B2',wlasciciel:'Wolund'}
};
let currentCompanyId=localStorage.getItem('dt1_current_company')||'mtoilet';
window.currentCompanyId = currentCompanyId;
let companyStates=JSON.parse(localStorage.getItem('dt1_company_states')||'{}');

// Udost�pnienie danych floty dla modu��w zewn�trznych, np. migracji Supabase
window.getTaxOrderVehicles = function(){ return vehs || []; };
window.setTaxOrderVehicles = function(list){
  vehs.splice(0, vehs.length, ...(list || []).map((v,i)=>({...v,id:i})));
  selected.clear();
  if (typeof renderVeh === "function") renderVeh();
  if (typeof updateCounters === "function") updateCounters();
  if (typeof renderDash === "function") renderDash();
};
function getCurrentCompany(){return COMPANIES[currentCompanyId];}

function saveCompanyState(){
  const state={vehs:vehs.map(v=>({...v})),selected:[...selected],taxYear:document.getElementById('taxYear')?.value||'2026',taxpayer:{}};
  ['nip','regon','nazwa','ulica','dom','lokal','kod','miasto','woj','organ','imie','nazwisko','cel'].forEach(k=>{const el=document.getElementById('tp-'+k);if(el)state.taxpayer[k]=el.value;});
  companyStates[currentCompanyId]=state;
  localStorage.setItem('dt1_company_states',JSON.stringify(companyStates));
  window.TaxOrderStateSync?.save(currentCompanyId);
}

function loadCompanyState(companyId){
  const company=COMPANIES[companyId];if(!company)return;
  const state=companyStates[companyId];
  if(state?.vehs?.length){
    vehs.splice(0,vehs.length,...state.vehs.map((v,i)=>({...v,id:i})));
  } else {
    const base=VEHICLES.filter(v=>{
      if(!v.wlasciciel)return companyId==='mtoilet';
      const w=v.wlasciciel.toLowerCase();
      if(companyId==='mtoilet')return w==='mtoilet';
      if(companyId==='gcon')return w==='gcon';
      if(companyId==='grental')return w==='grental'||w==='g-rental';
      if(companyId==='kjrsupply')return w.includes('kjr');
      if(companyId==='nwkinvest')return w.includes('nwk');
      if(companyId==='wolund')return w.includes('wolund');
      return false;
    }).map((v,i)=>({...v,id:i,osie:v.osie||2,zawieszenie:v.zawieszenie||'pneumatyczne',dmcZespolu:v.dmcZespolu||0,miesiacePodatku:v.miesiacePodatku||12}));
    vehs.splice(0,vehs.length,...base);
  }
  selected.clear();
  if(state?.selected)state.selected.forEach(id=>{if(vehs.find(v=>v.id===id))selected.add(id);});
  const tp={
    'tp-nip':state?.taxpayer?.nip||company.nip,
    'tp-regon':state?.taxpayer?.regon||company.regon,
    'tp-nazwa':state?.taxpayer?.nazwa||company.name,
    'tp-ulica':state?.taxpayer?.ulica||company.ulica,
    'tp-dom':state?.taxpayer?.dom||company.dom,
    'tp-lokal':state?.taxpayer?.lokal||company.lokal,
    'tp-kod':state?.taxpayer?.kod||company.kod,
    'tp-miasto':state?.taxpayer?.miasto||company.miasto,
    'tp-woj':state?.taxpayer?.woj||company.woj,
    'tp-organ':state?.taxpayer?.organ||company.organ,
    'tp-imie':state?.taxpayer?.imie||'',
    'tp-nazwisko':state?.taxpayer?.nazwisko||''
  };
  Object.entries(tp).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val||'';});
  const yrEl=document.getElementById('taxYear');if(yrEl)yrEl.value=state?.taxYear||'2026';
}

function switchCompany(companyId){
  if(!COMPANIES[companyId])return;
  saveCompanyState();
  currentCompanyId=companyId;
  window.currentCompanyId = companyId;
  localStorage.setItem('dt1_current_company',companyId);
  loadCompanyState(companyId);
  updateCompanyUI();
  refreshAll();
  toast('✓ Przełączono: '+COMPANIES[companyId].shortName);
  window.TaxOrderFleetCloud?.loadVehicles(companyId).then(r=>{
    if(r?.ok){
      refreshAll();
      window.TaxOrderFleetCloud?.subscribeRealTime?.(companyId);
    }
  });
}

function updateCompanyUI(){
  const c=getCurrentCompany();
  const sel=document.getElementById('company-selector');if(sel)sel.value=currentCompanyId;
  const badge=document.getElementById('company-badge');
  if(badge){badge.textContent=c.shortName;badge.style.background=c.color+'22';badge.style.color=c.color;badge.style.border='1px solid '+c.color+'55';}
  document.title='TaxOrder Pro — '+c.shortName+' — DT-1';
  // Aktualizuj lewą kolumnę topbar
  const brandEl=document.querySelector('.brand');
  if(brandEl){const span=brandEl.querySelector('span');if(span){span.textContent=c.shortName;span.style.background=c.color+'22';span.style.color=c.color;}}
}

function renderCompanyOverview(){
  const el=document.getElementById('companies-grid');
  if(!el)return;
  el.innerHTML=Object.values(COMPANIES).map(c=>{
    const state=companyStates[c.id];
    const vCount=state?.vehs?.length||0;
    const tax=state?.vehs?.reduce((s,v)=>{const t=calcTax(v);return s+(t.amount||0);},0)||0;
    const isCurrent=c.id===currentCompanyId;
    return `<div onclick="switchCompany('${c.id}')" style="background:${isCurrent?c.color+'11':'var(--bg2)'};border:2px solid ${isCurrent?c.color:'var(--border)'};border-radius:12px;padding:16px;cursor:pointer;transition:all .2s">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:12px;height:12px;border-radius:50%;background:${c.color}"></div>
        <div style="font-weight:600;font-size:14px">${c.shortName}</div>
        ${isCurrent?'<span style="font-size:10px;background:'+c.color+';color:#fff;padding:2px 6px;border-radius:4px;margin-left:auto">AKTYWNA</span>':''}
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:10px">NIP: ${c.nip}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:18px;font-weight:700;color:${c.color}">${vCount||'—'}</div>
          <div style="font-size:10px;color:var(--text2)">Pojazdy</div>
        </div>
        <div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:13px;font-weight:700;color:var(--green)">${tax>0?Math.round(tax).toLocaleString('pl-PL')+' zł':'—'}</div>
          <div style="font-size:10px;color:var(--text2)">DT-1 2026</div>
        </div>
      </div>
    </div>`;
  }).join('');
}



function renderAllCompaniesSummary() {
  const el = document.getElementById('all-companies-summary');
  if(!el) return;
  let rows = '';
  let grandTotal = 0;
  Object.values(COMPANIES).forEach(c => {
    const state = companyStates[c.id];
    const vList = state?.vehs || [];
    const taxable = vList.filter(v => getCat(v));
    const tax = vList.reduce((s,v) => s + (calcTax(v).amount||0), 0);
    grandTotal += tax;
    const isCur = c.id === currentCompanyId;
    rows += `<tr style="${isCur?'background:'+c.color+'11;font-weight:600':''}">
      <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color};margin-right:6px"></span>${c.shortName}</td>
      <td style="text-align:center">${vList.length}</td>
      <td style="text-align:center">${taxable.length}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--green)">${tax>0?Math.round(tax).toLocaleString('pl-PL')+' zł':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--blue)">${tax>0?Math.round(tax/2).toLocaleString('pl-PL')+' zł':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);color:var(--blue)">${tax>0?Math.round(tax-tax/2).toLocaleString('pl-PL')+' zł':'—'}</td>
    </tr>`;
  });
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr>
      <th style="text-align:left;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">Firma</th>
      <th style="text-align:center;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">Pojazdy</th>
      <th style="text-align:center;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">Z kat.</th>
      <th style="text-align:right;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">DT-1 2026</th>
      <th style="text-align:right;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">I rata</th>
      <th style="text-align:right;padding:6px 10px;background:var(--bg3);font-size:11px;color:var(--text2)">II rata</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="font-weight:700;border-top:2px solid var(--border)">
      <td style="padding:8px 10px">RAZEM GRUPA</td>
      <td></td><td></td>
      <td style="text-align:right;font-family:var(--mono);padding:8px 10px;color:var(--green)">${grandTotal>0?Math.round(grandTotal).toLocaleString('pl-PL')+' zł':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);padding:8px 10px;color:var(--blue)">${grandTotal>0?Math.round(grandTotal/2).toLocaleString('pl-PL')+' zł':'—'}</td>
      <td style="text-align:right;font-family:var(--mono);padding:8px 10px;color:var(--blue)">${grandTotal>0?Math.round(grandTotal-grandTotal/2).toLocaleString('pl-PL')+' zł':'—'}</td>
    </tr></tfoot>
  </table>`;
}



function selectAllTaxable() {
  let count=0;
  vehs.forEach(v=>{const t=calcTax(v);if(t&&t.cat){selected.add(v.id);count++;}});
  renderVeh&&renderVeh();updateCounters&&updateCounters();renderFormularze&&renderFormularze();
  toast('✅ Zaznaczono '+count+' pojazdów opodatkowanych (DT-1)');
}

// ==================== INIT ====================

// ==================== CEPiK INTEGRATION ====================
const CEPIK_TOKEN_URL = 'https://api-cpa.gov.pl/token';
const CEPIK_API_URL   = 'https://api.cepik.gov.pl';

// Mapa prefiksów → województwa
const WOJ_MAP = {
  // 3-literowe (precyzyjniejsze — sprawdzaj przed 2-literowymi)
  WPR:'14',WPP:'14',WPY:'14',WPZ:'14', // Mazowieckie — Pruszków i okolice
  WMA:'14',WMI:'14',WML:'14',          // Mazowieckie — Mińsk Maz., Milanówek
  WSK:'14',WSR:'14',                   // Mazowieckie — Sochaczew, Sierpc
  // 2-literowe
  W:'14',WA:'14',WB:'14',WD:'02',WE:'10',WF:'08',WG:'14',
  WK:'12',WL:'06',WN:'28',WO:'16',WP:'30',WR:'18',WS:'24',WT:'26',WZ:'32',
  K:'12',G:'22',P:'30',B:'20',C:'04',D:'02',E:'10',F:'08',L:'06',
  N:'28',O:'16',R:'18',S:'24',T:'26',Z:'32'};

const CEPIK_FIELDS = {
  'marka':'marka', 'model':'model',
  'dopuszczalna-masa-calkowita':'dmc',
  'dopuszczalna-masa-calkowita-zespolu-pojazdow':'dmcZespolu',
  'liczba-osi':'osie', 'rok-produkcji':'rok',
  'data-pierwszej-rejestracji-w-kraju':'dataRejestracji',
  'masa-wlasna':'masaWlasna', 'rodzaj-paliwa':'paliwo',
  'pojemnosc-skokowa-silnika':'pojSilnika', 'moc-netto-silnika':'mocKW',
  'rodzaj-zawieszenia':'zawieszenie',
  'przeznaczenie-pojazdu':'przeznaczenie'
};
const CEPIK_LABELS = {
  marka:'Marka (D.1)', model:'Model (D.2)', dmc:'DMC kg (F.1)',
  dmcZespolu:'DMC zesp. kg (F.3)', osie:'Liczba osi (L)', rok:'Rok prod.',
  dataRejestracji:'Data 1. rej. (B)', masaWlasna:'Masa własna kg (G)',
  paliwo:'Paliwo (P.3)', pojSilnika:'Pojemność cm³ (P.1)', mocKW:'Moc kW (P.2)',
  zawieszenie:'Zawieszenie (§17)', przeznaczenie:'Przeznaczenie pojazdu'
};

// State
let cepikConsumerKey    = localStorage.getItem('dt1_cepik_key')    || 'P1uJWJ6PQKNAPwd9fdNQeQr0fuIa';
let cepikConsumerSecret = localStorage.getItem('dt1_cepik_secret') || '5NVf8JnqaIBVvIIPznJWJBFD8ZYa';
let cepikToken          = localStorage.getItem('dt1_cepik_token')||'';
let cepikTokenExpires   = parseInt(localStorage.getItem('dt1_cepik_token_exp')||'0');
let cepikProxy          = localStorage.getItem('dt1_cepik_proxy')||'';
let cepikSettings       = JSON.parse(localStorage.getItem('dt1_cepik_settings')||'{"autoEnable":false,"autoHour":6,"notify":"dmc"}');
let cepikCache          = JSON.parse(localStorage.getItem('dt1_cepik_cache')||'{}');
let cepikLastCheck      = localStorage.getItem('dt1_cepik_last_check')||null;
let cepikStats          = {total:0,ok:0,dmc:0,vin:0,notfound:0,err:0};
let batchRunning        = false;
let tokenRefreshTimer   = null;

// --- UI helpers ---
function toggleVis(inputId, iconId) {
  const inp = document.getElementById(inputId);
  const ico = document.getElementById(iconId);
  if(!inp) return;
  inp.type = inp.type==='password' ? 'text' : 'password';
  if(ico) ico.className = inp.type==='password' ? 'ti ti-eye' : 'ti ti-eye-off';
}
function cepikLog(msg, type='info') {
  const el = document.getElementById('cepik-conn-log');
  if(!el) return;
  const color = {info:'var(--text2)',ok:'var(--green)',warn:'var(--amber)',err:'var(--red)'}[type]||'var(--text2)';
  const time = new Date().toLocaleTimeString('pl-PL');
  el.innerHTML = `<span style="color:${color}">[${time}] ${esc(msg)}</span>\n` + el.innerHTML;
}
function updateCepikStatus(status) {
  const pill = document.getElementById('cepik-status-pill');
  if(!pill) return;
  const map = {
    none:   {cls:'pill-gray',  txt:'⚪ Nie skonfigurowano'},
    testing:{cls:'pill-amber', txt:'🔄 Łączenie...'},
    ok:     {cls:'pill-green', txt:'✅ Połączono z CEPiK'},
    cors:   {cls:'pill-amber', txt:'⚠ CORS — potrzebny proxy'},
    expired:{cls:'pill-amber', txt:'⚠ Token wygasł — odśwież'},
    err:    {cls:'pill-red',   txt:'❌ Błąd autoryzacji'},
  };
  const m = map[status]||map.none;
  pill.className = 'pill '+m.cls;
  pill.textContent = m.txt;
}
function showTokenBox(token, expiresIn) {
  const box = document.getElementById('cepik-token-box');
  const disp = document.getElementById('cepik-token-display');
  const exp  = document.getElementById('cepik-token-expires');
  if(box)  box.style.display='block';
  if(disp) disp.value = token;
  if(exp && expiresIn) {
    const mins = Math.floor(expiresIn/60);
    exp.textContent = `(wygasa za ${mins} min, auto-odświeżanie włączone)`;
  }
  const refreshBtn = document.getElementById('cepik-refresh-btn');
  if(refreshBtn) refreshBtn.style.display='';
}
function copyToken() {
  const t = document.getElementById('cepik-token-display')?.value||'';
  if(t) { navigator.clipboard.writeText(t).then(()=>toast('✓ Token skopiowany do schowka')); }
}

// --- OAuth2 — generowanie tokenu ---
async function cepikGetToken(key, secret) {
  const credentials = btoa(key + ':' + secret);
  // Zawsze używaj CF Worker proxy (rozwiązuje CORS + IP whitelist api-cpa.gov.pl)
  const workerBase = (window.CF_WORKER_URL||'').replace(/\/$/,'');
  if(workerBase) {
    cepikLog('Generuję token OAuth2 przez CF Worker proxy...','info');
    const resp = await fetch(workerBase + '/api/cepik/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + credentials,
        'Content-Type':  'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    if(!resp.ok) {
      const txt = await resp.text().catch(()=>'');
      throw new Error(`CF proxy token: HTTP ${resp.status} — ${txt.slice(0,120)}`);
    }
    const data = await resp.json();
    if(!data.access_token) throw new Error('Brak access_token w odpowiedzi: '+JSON.stringify(data).slice(0,100));
    return data;
  }
  // Fallback: bezpośrednie połączenie (może być blokowane przez CORS)
  cepikLog('Generuję token OAuth2 z api-cpa.gov.pl (bez proxy)...','info');
  const resp = await fetch(CEPIK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + credentials,
      'Content-Type':  'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if(!resp.ok) {
    const txt = await resp.text().catch(()=>'');
    throw new Error(`Token endpoint: HTTP ${resp.status} — ${txt.slice(0,120)}`);
  }
  const data = await resp.json();
  if(!data.access_token) throw new Error('Brak access_token w odpowiedzi: '+JSON.stringify(data).slice(0,100));
  return data;
}

async function cepikConnect() {
  const key    = document.getElementById('cepik-key')?.value?.trim()||'';
  const secret = document.getElementById('cepik-secret')?.value?.trim()||'';
  const proxy  = document.getElementById('cepik-proxy')?.value?.trim()||'';
  if(!key||!secret) { toast('⚠ Wpisz Klucz klienta i Klucz sekretny'); return; }

  const btn = document.getElementById('cepik-connect-btn');
  if(btn) { btn.disabled=true; btn.innerHTML='<i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>Łączenie...'; }
  updateCepikStatus('testing');

  try {
    const data = await cepikGetToken(key, secret);
    const token  = data.access_token;
    const expIn  = data.expires_in || 3600;
    const expAt  = Date.now() + expIn*1000;

    // Zapisz
    cepikConsumerKey    = key;
    cepikConsumerSecret = secret;
    cepikToken          = token;
    cepikTokenExpires   = expAt;
    cepikProxy          = proxy;
    localStorage.setItem('dt1_cepik_key',    key);
    localStorage.setItem('dt1_cepik_secret', secret);
    localStorage.setItem('dt1_cepik_token',  token);
    localStorage.setItem('dt1_cepik_token_exp', String(expAt));
    if(proxy) localStorage.setItem('dt1_cepik_proxy', proxy);

    cepikLog(`✅ Token wygenerowany! Wygasa za ${Math.floor(expIn/60)} min.`,'ok');
    showTokenBox(token, expIn);
    updateCepikStatus('ok');

    // Zaplanuj auto-refresh na 5 min przed wygaśnięciem
    scheduleTokenRefresh(expIn - 300);

    // Test call do CEPiK
    await cepikTestCall();

  } catch(e) {
    cepikLog('❌ Błąd: '+e.message,'err');
    updateCepikStatus(e.message.includes('401')||e.message.includes('403')?'err':'cors');
    toast('⚠ Błąd połączenia: '+e.message.slice(0,80));
  } finally {
    if(btn) { btn.disabled=false; btn.innerHTML='<i class="ti ti-plug"></i>Połącz z CEPiK (generuj token)'; }
  }
}

async function cepikRefreshToken() {
  if(!cepikConsumerKey||!cepikConsumerSecret) { toast('⚠ Brak kluczy — wpisz Consumer Key i Secret'); return; }
  try {
    cepikLog('Odświeżam token...','info');
    const data  = await cepikGetToken(cepikConsumerKey, cepikConsumerSecret);
    cepikToken  = data.access_token;
    cepikTokenExpires = Date.now() + (data.expires_in||3600)*1000;
    localStorage.setItem('dt1_cepik_token',  cepikToken);
    localStorage.setItem('dt1_cepik_token_exp', String(cepikTokenExpires));
    showTokenBox(cepikToken, data.expires_in||3600);
    updateCepikStatus('ok');
    scheduleTokenRefresh((data.expires_in||3600) - 300);
    cepikLog('✅ Token odświeżony','ok');
    toast('✅ Token CEPiK odświeżony');
  } catch(e) {
    cepikLog('❌ Refresh nieudany: '+e.message,'err');
    updateCepikStatus('expired');
  }
}

function scheduleTokenRefresh(inSeconds) {
  if(tokenRefreshTimer) clearTimeout(tokenRefreshTimer);
  if(inSeconds > 0) {
    cepikLog(`⏱ Auto-refresh tokenu zaplanowany za ${Math.floor(inSeconds/60)} min`,'info');
    tokenRefreshTimer = setTimeout(()=>cepikRefreshToken(), inSeconds*1000);
  }
}

async function cepikTestCall() {
  cepikLog('Testuję połączenie z api.cepik.gov.pl...','info');
  try {
    // Test z pierwszym pojazdem floty
    const testNr = vehs[0]?.nrRej || 'WA4789F';
    const result = await cepikFetch(testNr, getWoj(testNr));
    const count  = result?.data?.length||0;
    cepikLog(`✅ API CEPiK odpowiada — znaleziono ${count} rekordów dla ${testNr}`,'ok');
    toast(`✅ CEPiK działa! Znaleziono ${count} rekordów dla ${testNr}`);
  } catch(e) {
    if(e.message.includes('CORS')||e.message.includes('Failed to fetch')||e.message.includes('NetworkError')) {
      cepikLog('⚠ Problem CORS na api.cepik.gov.pl — token OK, ale potrzebny serwer proxy','warn');
      updateCepikStatus('cors');
      document.getElementById('cepik-single-result').innerHTML = showCorsHelp(true);
    } else {
      cepikLog('⚠ Test API: '+e.message,'warn');
    }
  }
}

function clearCepikConfig() {
  if(!confirm('Usunąć całą konfigurację CEPiK (klucze, token, cache)?')) return;
  ['dt1_cepik_key','dt1_cepik_secret','dt1_cepik_token','dt1_cepik_token_exp','dt1_cepik_proxy','dt1_cepik_cache','dt1_cepik_last_check'].forEach(k=>localStorage.removeItem(k));
  cepikConsumerKey='';cepikConsumerSecret='';cepikToken='';cepikProxy='';cepikCache={};
  if(document.getElementById('cepik-key')) document.getElementById('cepik-key').value='';
  if(document.getElementById('cepik-secret')) document.getElementById('cepik-secret').value='';
  const box=document.getElementById('cepik-token-box');if(box)box.style.display='none';
  const rb=document.getElementById('cepik-refresh-btn');if(rb)rb.style.display='none';
  updateCepikStatus('none');
  cepikLog('Konfiguracja wyczyszczona','warn');
  toast('✓ Konfiguracja CEPiK usunięta');
}

// --- Czy token jest ważny? ---
function isCepikTokenValid() {
  return cepikToken && Date.now() < cepikTokenExpires - 60000;
}

// --- Fetch z auto-refresh ---
async function getValidToken() {
  if(isCepikTokenValid()) return cepikToken;
  if(cepikConsumerKey && cepikConsumerSecret) {
    cepikLog('Token wygasł — automatyczne odświeżanie...','warn');
    const data = await cepikGetToken(cepikConsumerKey, cepikConsumerSecret);
    cepikToken = data.access_token;
    cepikTokenExpires = Date.now() + (data.expires_in||3600)*1000;
    localStorage.setItem('dt1_cepik_token',  cepikToken);
    localStorage.setItem('dt1_cepik_token_exp', String(cepikTokenExpires));
    scheduleTokenRefresh((data.expires_in||3600) - 300);
    return cepikToken;
  }
  throw new Error('Brak ważnego tokenu i brak kluczy do odświeżenia');
}

// --- Województwo z nr rej ---
function getWoj(nrRej) {
  const nr = (nrRej||'').toUpperCase().replace(/\s/g,'');
  // 3 litery (np. WPR → Mazowieckie), potem 2, potem 1
  if(WOJ_MAP[nr.slice(0,3)]) return WOJ_MAP[nr.slice(0,3)];
  if(WOJ_MAP[nr.slice(0,2)]) return WOJ_MAP[nr.slice(0,2)];
  if(WOJ_MAP[nr[0]]) return WOJ_MAP[nr[0]];
  return document.getElementById('cepik-woj')?.value||'14';
}

// Wszystkie kody województw CEPiK
const ALL_WOJ_CODES = ['02','04','06','08','10','12','14','16','18','20','22','24','26','28','30','32'];

// --- Jedno zapytanie do CEPiK przez CF Worker proxy ---
async function _cepikFetchOne(nr, wojCode, token, year) {
  const workerBase = (window.CF_WORKER_URL||'').replace(/\/$/,'');
  if(workerBase) {
    // CF Worker proxy — omija CORS i whitelist IP
    const proxyUrl = `${workerBase}/api/cepik/pojazdy?nr=${encodeURIComponent(nr)}&woj=${wojCode}&rok=${year}`;
    const resp = await fetch(proxyUrl, { headers: { 'X-Cepik-Token': token } });
    if(!resp.ok) {
      const txt = await resp.text().catch(()=>'');
      throw new Error(`CF proxy ${wojCode}: HTTP ${resp.status} ${txt.slice(0,80)}`);
    }
    return resp.json();
  }
  // Fallback bezpośredni (może fail CORS)
  const apiUrl = `${CEPIK_API_URL}/pojazdy?numer-rejestracyjny=${encodeURIComponent(nr)}&wojewodztwo=${wojCode}&data-od=${year}0101&data-do=${year}1231&limit=1&pokaz-wszystkie-pola=true`;
  const resp = await fetch(apiUrl, {
    headers: { 'Accept': 'application/vnd.api+json', 'Authorization': 'Bearer ' + token },
    mode: 'cors'
  });
  if(!resp.ok) throw new Error('HTTP '+resp.status);
  return resp.json();
}

// --- Główna funkcja fetch z proxy + "szukaj we wszystkich województwach" ---
async function cepikFetch(nrRej, woj) {
  const nr = (nrRej||'').toUpperCase().replace(/\s/g,'');
  const guessedWoj = getWoj(nr);
  const wojCode    = (woj==='auto'||!woj) ? guessedWoj : woj;
  const searchAll  = (woj==='auto'||!woj); // gdy woj nie podano przez użytkownika
  // Cache 24h
  const cacheKey = nr+'_'+wojCode;
  const cached   = cepikCache[cacheKey];
  if(cached && Date.now()-cached.ts < 24*60*60*1000) {
    cepikLog(`📦 Cache: ${nr} (woj ${wojCode})`,'info');
    return cached.data;
  }

  const token = await getValidToken();
  const year  = new Date().getFullYear();

  // 1. Próbuj z odgadniętym/podanym województwem, cofając się 2 lata
  let data;
  for(let y = year; y >= year - 2; y--) {
    cepikLog(`📡 CF proxy: ${nr} woj=${wojCode} rok=${y}`, 'info');
    try {
      data = await _cepikFetchOne(nr, wojCode, token, y);
    } catch(e) { throw e; }
    if((data?.data?.length||0) > 0) break;
    if(y > year - 2) await new Promise(r=>setTimeout(r,250));
  }

  // 2. Jeśli nie znaleziono i woj było odgadnięte — przeszukaj wszystkie województwa
  if(searchAll && (data?.data?.length||0) === 0) {
    const remaining = ALL_WOJ_CODES.filter(c => c !== wojCode);
    cepikLog(`🔍 Nie znaleziono w woj ${wojCode} — szukam w pozostałych ${remaining.length} województwach...`, 'warn');
    for(const w of remaining) {
      await new Promise(r=>setTimeout(r,300));
      try {
        const d = await _cepikFetchOne(nr, w, token, year);
        if((d?.data?.length||0) > 0) {
          cepikLog(`✅ Znaleziono ${nr} w województwie ${w}`, 'ok');
          data = d;
          // Zapisz do cache pod właściwym województwem
          cepikCache[nr+'_'+w] = {ts:Date.now(), data:d};
          localStorage.setItem('dt1_cepik_cache', JSON.stringify(cepikCache));
          return d;
        }
      } catch { /* spróbuj kolejne */ }
    }
  }

  cepikCache[cacheKey] = {ts:Date.now(), data};
  localStorage.setItem('dt1_cepik_cache', JSON.stringify(cepikCache));
  return data;
}

// --- Parser atrybutów CEPiK ---
function parseCepikAttrs(attrs) {
  const out={};
  Object.entries(CEPIK_FIELDS).forEach(([apiKey,vehKey])=>{
    const val=attrs[apiKey];
    if(val===undefined||val===null||val==='')return;
    if(['dmc','dmcZespolu','masaWlasna','pojSilnika','mocKW'].includes(vehKey))
      out[vehKey]=parseFloat(String(val).replace(/[\s]/g,''))||null;
    else if(['osie','rok'].includes(vehKey))
      out[vehKey]=parseInt(val)||null;
    else if(vehKey==='zawieszenie')
      out[vehKey]=(String(val)||'').toLowerCase().includes('pneumat')?'pneumatyczne':(String(val)||'').toLowerCase().includes('równow')?'równoważne':'inne';
    else
      out[vehKey]=String(val).trim();
  });
  return out;
}

function diffCepikVeh(cepikData, veh) {
  return Object.entries(cepikData)
    .filter(([key,cv])=>{
      if(cv===null||cv===undefined)return false;
      const vv=veh[key];
      return String(cv).trim().toLowerCase()!==String(vv||'').trim().toLowerCase()&&String(vv||'').trim()!=='';
    })
    .map(([key,cv])=>({key,label:CEPIK_LABELS[key]||key,cepik:cv,baza:veh[key]}));
}

// --- Sprawdzenie jednego pojazdu ---
async function cepikCheckSingle() {
  const nr  = (document.getElementById('cepik-single-nr')?.value||'').trim().toUpperCase().replace(/\s/g,'');
  const woj = document.getElementById('cepik-single-woj')?.value||'auto';
  if(!nr) { toast('⚠ Wpisz numer rejestracyjny'); return; }
  const resEl=document.getElementById('cepik-single-result');
  if(!resEl) return;

  if(!cepikToken && !cepikConsumerKey) { resEl.innerHTML=renderNeedToken(); return; }
  resEl.innerHTML='<div class="ibox"><i class="ti ti-loader" style="animation:spin 1s linear infinite"></i>Odpytuję CEPiK API...</div>';

  try {
    const json = await cepikFetch(nr, woj==='auto'?'auto':woj);
    const items = json?.data||[];
    if(!items.length) {
      resEl.innerHTML=`<div class="wbox"><i class="ti ti-alert-triangle"></i>Pojazd <strong>${nr}</strong> nie znaleziony w CEPiK w żadnym województwie. Sprawdź numer rejestracyjny.</div>`;
      return;
    }
    const attrs    = items[0]?.attributes||{};
    const cepikData= parseCepikAttrs(attrs);
    const veh      = vehs.find(v=>v.nrRej.toUpperCase().replace(/\s/g,'')=== nr);
    renderSingleResult(nr, cepikData, veh, resEl);
    cepikLog(`✅ Dane dla ${nr} pobrane z CEPiK`,'ok');
  } catch(e) {
    resEl.innerHTML = renderApiError(e, nr);
    cepikLog('❌ '+nr+': '+e.message,'err');
  }
}

function renderSingleResult(nr, cepikData, veh, container) {
  const diffs = veh ? diffCepikVeh(cepikData,veh) : [];
  let html=`<div class="${diffs.length?'wbox':'gbox'}" style="margin-bottom:10px">
    <i class="ti ti-${diffs.length?'alert-triangle':'circle-check'}"></i>
    <div><strong>${nr}</strong> — ${diffs.length
      ? `<span style="color:var(--red)">${diffs.length} rozbieżności z Twoją bazą</span>`
      : 'Dane w pełni zgodne z CEPiK ✅'}
    ${!veh?'<span style="color:var(--amber);font-size:11px"> · Pojazd nie znaleziony w bazie</span>':''}
    </div></div>`;

  html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:10px">
    <div style="display:grid;grid-template-columns:160px 1fr 1fr;background:var(--bg3);border-bottom:1px solid var(--border)">
      <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">Pole DT-1</div>
      <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--blue)">📡 CEPiK (oficjalne)</div>
      <div style="padding:8px 12px;font-size:11px;font-weight:600;color:var(--text2)">📋 Twoja baza</div>
    </div>
    ${Object.entries(CEPIK_LABELS).map(([key,label])=>{
      const cv=cepikData[key], bv=veh?veh[key]:'—';
      const diff=cv&&bv&&bv!=='—'&&String(cv).toLowerCase()!==String(bv||'').toLowerCase();
      return `<div style="display:grid;grid-template-columns:160px 1fr 1fr;border-bottom:0.5px solid var(--border);align-items:center;${diff?'background:var(--amber-light)':''}">
        <div style="padding:7px 12px;font-size:11px;font-weight:500;color:var(--text2)">${label}</div>
        <div style="padding:7px 12px;font-size:12px;font-family:var(--mono);font-weight:${cv?'600':'400'};color:${cv?'var(--text)':'var(--text3)'}">
          ${cv||'—'}${diff?'<span class="diff-badge" style="background:var(--amber)">RÓŻNICA</span>':''}
        </div>
        <div style="padding:7px 12px;font-size:12px;font-family:var(--mono);color:var(--text2)">${bv!==undefined&&bv!==''&&bv!==null?bv:'—'}</div>
      </div>`;
    }).join('')}
  </div>`;

  if(veh && diffs.length) {
    html+=`<button class="btn btn-blue" onclick="cepikApplyToVeh(${veh.id},${JSON.stringify(cepikData).replace(/"/g,'&quot;')})">
      <i class="ti ti-database-import"></i>Zastosuj dane z CEPiK do pojazdu ${nr} (${diffs.length} pól)
    </button>`;
  }
  container.innerHTML=html;
  updateCepikStatsUI();
}

// --- Weryfikacja wsadowa ---
async function cepikBatchCheck(mode) {
  if(batchRunning){toast('⚠ Weryfikacja już trwa');return;}
  if(!cepikToken&&!cepikConsumerKey){
    document.getElementById('cepik-batch-results').innerHTML=renderNeedToken();return;
  }

  let batch;
  if(mode==='all')      batch=vehs;
  else if(mode==='sel') batch=getSel();
  else                  batch=vehs.filter(v=>cepikCache[v.nrRej+'_'+getWoj(v.nrRej)]?.diffs?.length);
  if(!batch.length){toast('⚠ Brak pojazdów do weryfikacji');return;}

  // Pre-flight: sprawdź token 1 wywołaniem zanim uruchomimy cały batch.
  // Zapobiega 150+ failującym requestom gdy token wygasł / dane logowania są błędne.
  const res=document.getElementById('cepik-batch-results');
  if(res) res.innerHTML='<div class="ibox"><i class="ti ti-loader" style="animation:spin 1s linear infinite"></i> Weryfikacja połączenia CEPiK...</div>';
  try {
    const testV = batch.find(v => {
      const ck = v.nrRej+'_'+getWoj(v.nrRej);
      return !cepikCache[ck] || Date.now()-cepikCache[ck].ts > 24*60*60*1000;
    }) || batch[0];
    await cepikFetch(testV.nrRej, getWoj(testV.nrRej));
    cepikLog('✅ Pre-flight OK — połączenie z CEPiK działa','ok');
  } catch(e) {
    if(res) res.innerHTML=`<div class="ebox"><i class="ti ti-alert-circle"></i><div><strong>Błąd CEPiK — batch przerwany.</strong><br><span style="font-size:12px">${esc(e.message)}<br>Sprawdź konfigurację tokenu lub odśwież połączenie powyżej.</span></div></div>`;
    cepikLog('❌ Pre-flight nieudany: '+e.message,'err');
    return;
  }

  batchRunning=true;
  cepikStats={total:0,ok:0,dmc:0,vin:0,notfound:0,err:0};
  const prog=document.getElementById('cepik-batch-progress');
  const bar=document.getElementById('cepik-batch-bar');
  const stat=document.getElementById('cepik-batch-status');
  const pct=document.getElementById('cepik-batch-pct');
  const detail=document.getElementById('cepik-batch-detail');
  if(prog) prog.classList.remove('hidden');
  if(res)  res.innerHTML='';

  const results=[];
  let consecutiveErrors=0;
  const MAX_CONSECUTIVE_ERRORS=5; // abort batch po 5 błędach z rzędu — nie ma sensu odpytywać 150 pojazdów gdy API nie działa

  for(let i=0;i<batch.length;i++){
    if(consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      cepikLog(`⛔ Batch przerwany po ${MAX_CONSECUTIVE_ERRORS} kolejnych błędach — sprawdź połączenie z CEPiK`,'err');
      results.push(...batch.slice(i).map(v=>({v,status:'skipped',err:'Batch przerwany po zbyt wielu błędach',diffs:[]})));
      break;
    }
    const v=batch[i];
    const cacheKey=v.nrRej+'_'+getWoj(v.nrRej);
    const fromCache=cepikCache[cacheKey]&&Date.now()-cepikCache[cacheKey].ts<24*60*60*1000;
    const pctVal=Math.round((i/batch.length)*100);
    if(bar)    bar.style.width=pctVal+'%';
    if(pct)    pct.textContent=pctVal+'%';
    if(stat)   stat.textContent=`${fromCache?'📦 Cache':'📡 API'}: ${v.nrRej} (${i+1}/${batch.length})`;
    if(detail) detail.textContent=`${v.marka} ${v.model} — ${getWoj(v.nrRej)} woj.${fromCache?' [z cache]':''}`;
    // Opóźnienie tylko dla żywych żądań API (nie cache)
    if(i>0 && !fromCache) await new Promise(r=>setTimeout(r,400));
    try {
      const json =await cepikFetch(v.nrRej, getWoj(v.nrRej));
      consecutiveErrors=0; // reset po udanym wywołaniu
      const items=json?.data||[];
      cepikStats.total++;
      if(!items.length){cepikStats.notfound++;results.push({v,status:'notfound',diffs:[]});continue;}
      const attrs    =items[0]?.attributes||{};
      const cepikData=parseCepikAttrs(attrs);
      const diffs    =diffCepikVeh(cepikData,v);
      if(!diffs.length)cepikStats.ok++;
      else{
        if(diffs.some(d=>d.key==='dmc'||d.key==='osie'))cepikStats.dmc++;
        if(diffs.some(d=>d.key==='przeznaczenie'))cepikStats.vin++;
      }
      results.push({v,status:diffs.length?'diff':'ok',diffs,cepikData});
      if(cepikCache[cacheKey])cepikCache[cacheKey].diffs=diffs;
    } catch(e) {
      consecutiveErrors++;
      cepikStats.err++;
      results.push({v,status:'err',err:e.message,diffs:[]});
      cepikLog('❌ '+v.nrRej+': '+e.message,'err');
    }
  }
  if(bar)  bar.style.width='100%';
  if(pct)  pct.textContent='100%';
  if(stat) stat.textContent='Weryfikacja zakończona ✅';
  batchRunning=false;
  cepikLastCheck=new Date().toLocaleString('pl-PL');
  localStorage.setItem('dt1_cepik_last_check',cepikLastCheck);
  localStorage.setItem('dt1_cepik_cache',JSON.stringify(cepikCache));
  updateCepikStatsUI();
  renderBatchResults(results);
  toast(`✅ CEPiK: ${cepikStats.ok} OK · ${cepikStats.dmc} różnic DMC · ${cepikStats.notfound} nie znaleziono · ${cepikStats.err} błędów`);
}

function renderBatchResults(results) {
  const el=document.getElementById('cepik-batch-results');if(!el)return;
  const diffs   =results.filter(r=>r.status==='diff');
  const errs    =results.filter(r=>r.status==='err');
  const notfound=results.filter(r=>r.status==='notfound');
  const ok      =results.filter(r=>r.status==='ok');
  let html='';
  if(diffs.length){
    html+=`<div style="font-size:13px;font-weight:600;color:var(--amber);margin:14px 0 8px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-triangle"></i>${diffs.length} pojazdów z rozbieżnościami względem CEPiK</div>`;
    html+=`<div class="tbl-wrap" style="margin-bottom:10px"><table>
      <thead><tr><th>Nr rej.</th><th>Marka / Model</th><th>Rok</th><th>Rozbieżne pola</th><th></th></tr></thead>
      <tbody>${diffs.map(({v,diffs:ds,cepikData})=>`<tr>
        <td><strong style="font-family:var(--mono)">${esc(v.nrRej)}</strong></td>
        <td style="font-size:12px">${esc(v.marka)} ${esc(v.model)}</td>
        <td style="text-align:center">${v.rok||'—'}</td>
        <td>${ds.map(d=>`<div style="font-size:10px;margin-bottom:2px"><span style="color:var(--amber);font-weight:500">${esc(d.label)}:</span> <span style="font-family:var(--mono)">${esc(d.baza||'—')}</span> <i class="ti ti-arrow-right" style="font-size:9px"></i> <span style="font-family:var(--mono);font-weight:600;color:var(--blue)">${esc(d.cepik)}</span></div>`).join('')}</td>
        <td><button class="btn btn-blue" style="font-size:11px;padding:5px 10px" onclick='cepikApplyToVeh(${v.id},${JSON.stringify(cepikData||{})})'>
          <i class="ti ti-database-import"></i>Aktualizuj
        </button></td>
      </tr>`).join('')}</tbody></table></div>
    <button class="btn btn-amber" onclick='cepikApplyAll(${JSON.stringify(diffs.map(r=>({id:r.v.id,data:r.cepikData||{}})))})'>
      <i class="ti ti-database-import"></i>Zaktualizuj wszystkie ${diffs.length} pojazdy z rozbieżnościami
    </button>`;
  }
  if(notfound.length){
    html+=`<div class="wbox" style="margin-top:12px"><i class="ti ti-alert-triangle"></i><div><strong>${notfound.length} pojazdów nie znaleziono w CEPiK:</strong> ${notfound.map(r=>r.v.nrRej).join(', ')}<br><span style="font-size:11px">Sprawdź ręcznie na historiapojazdu.gov.pl lub czy pojazdy są zarejestrowane w prawidłowym województwie.</span></div></div>`;
  }
  if(ok.length){
    html+=`<div class="gbox" style="margin-top:10px"><i class="ti ti-circle-check"></i><strong>${ok.length} pojazdów</strong> — dane w pełni zgodne z CEPiK</div>`;
  }
  if(errs.length){
    const isCors=errs.some(r=>(r.err||'').includes('CORS')||(r.err||'').includes('fetch'));
    if(isCors) html+=showCorsHelp(true);
    else html+=`<div class="ebox" style="margin-top:10px"><i class="ti ti-alert-circle"></i>${errs.length} błędów API: ${errs.map(r=>r.v.nrRej+' ('+r.err+')').join(', ')}</div>`;
  }
  el.innerHTML=html||'<div class="gbox"><i class="ti ti-circle-check"></i>Wszystkie pojazdy zgodne z CEPiK!</div>';
}

function cepikApplyToVeh(vehId, cepikData) {
  const v=vehs.find(x=>x.id===vehId);if(!v)return;
  let applied=0;
  Object.entries(cepikData).forEach(([key,val])=>{
    if(val!==null&&val!==undefined&&String(val).trim()){v[key]=val;applied++;}
  });
  renderVeh();updateCounters();
  toast(`✓ ${v.nrRej}: zaktualizowano ${applied} pól z CEPiK`);
}

function cepikApplyAll(items) {
  let total=0;
  (items||[]).forEach(({id,data})=>{
    const v=vehs.find(x=>x.id===id);if(!v)return;
    Object.entries(data||{}).forEach(([k,val])=>{if(val!==null&&val!==undefined){v[k]=val;total++;}});
  });
  renderVeh();updateCounters();
  toast(`✓ Zaktualizowano ${items.length} pojazdów z CEPiK (${total} pól łącznie)`);
}

// --- Auto-weryfikacja ---
function toggleCepikAuto(){cepikSettings.autoEnable=document.getElementById('cepik-auto-enable')?.checked||false;saveCepikSettings();}
function saveCepikSettings(){
  cepikSettings.autoHour=parseInt(document.getElementById('cepik-auto-hour')?.value)||6;
  cepikSettings.notify=document.getElementById('cepik-notify')?.value||'dmc';
  localStorage.setItem('dt1_cepik_settings',JSON.stringify(cepikSettings));
  toast('✓ Ustawienia CEPiK zapisane');
}

function checkCepikAuto() {
  if(!cepikSettings.autoEnable) return;
  if(!cepikToken && !cepikConsumerKey) return;
  const last=cepikLastCheck?new Date(cepikLastCheck):null;
  if(!last||Date.now()-last.getTime()>22*60*60*1000) {
    console.log('[CEPiK] Auto-weryfikacja...');
    setTimeout(()=>cepikBatchCheck('all'),5000);
  }
}

// --- Helpers ---
function updateCepikStatsUI() {
  const s=id=>document.getElementById(id);
  if(s('cs-total'))    s('cs-total').textContent=cepikStats.total;
  if(s('cs-ok'))       s('cs-ok').textContent=cepikStats.ok;
  if(s('cs-dmc'))      s('cs-dmc').textContent=cepikStats.dmc;
  if(s('cs-vin'))      s('cs-vin').textContent=cepikStats.vin;
  if(s('cs-notfound')) s('cs-notfound').textContent=cepikStats.notfound;
  if(s('cs-err'))      s('cs-err').textContent=cepikStats.err;
  if(s('cepik-last-check'))s('cepik-last-check').textContent=cepikLastCheck||'nigdy';
  if(s('cepik-all-cnt'))   s('cepik-all-cnt').textContent=vehs.length;
  if(s('cepik-sel-cnt'))   s('cepik-sel-cnt').textContent=selected.size;
  // Następna auto-weryfikacja
  if(s('cepik-next-check')&&cepikSettings.autoEnable){
    const h=cepikSettings.autoHour||6;
    const next=new Date();
    if(next.getHours()>=h)next.setDate(next.getDate()+1);
    next.setHours(h,0,0,0);
    s('cepik-next-check').textContent=next.toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
}

function renderNeedToken() {
  return `<div class="wbox"><i class="ti ti-key"></i><div><strong>Wymagana konfiguracja CEPiK API.</strong><br>
    <span style="font-size:12px">Wpisz Klucz klienta i Klucz sekretny w sekcji Konfiguracja powyżej, następnie kliknij <strong>Połącz z CEPiK</strong>.<br>
    Nie masz kluczy? <a href="https://cpa.gov.pl/store/apis/info?name=CEPiK&version=1.0&provider=cpa" target="_blank" style="color:var(--blue)">Uzyskaj bezpłatnie na cpa.gov.pl →</a></span>
  </div></div>`;
}

function renderApiError(e, nr) {
  const isCors=e.message.includes('CORS')||e.message.includes('NetworkError')||e.message.includes('Failed to fetch');
  return isCors ? showCorsHelp(true) : `<div class="ebox"><i class="ti ti-alert-circle"></i><div><strong>Błąd API dla ${nr}:</strong> ${e.message}</div></div>`;
}

function showCorsHelp(returnStr=false) {
  const workerOk = !!(window.CF_WORKER_URL||'');
  const html=`<div style="background:var(--amber-light);border:1px solid #EF9F27;border-radius:var(--radius-lg);padding:16px;margin-top:8px">
    <div style="font-size:13px;font-weight:600;color:#633806;margin-bottom:10px"><i class="ti ti-alert-triangle"></i> Problem CORS — przeglądarka blokuje bezpośrednie zapytania do api.cepik.gov.pl</div>
    ${workerOk
      ? `<div style="font-size:12px;color:#1a7a2e;font-weight:600;margin-bottom:8px">✅ CF Worker proxy aktywny (${(window.CF_WORKER_URL||'').replace(/https?:\/\//,'')}). Zapytania są kierowane przez serwer — CORS nie powinien blokować. Jeśli problem nadal występuje, sprawdź konfigurację Worker.</div>`
      : `<div style="font-size:12px;color:#633806;margin-bottom:10px">Token jest OK! Problem polega na tym, że CEPiK wymaga, aby zapytania przychodziły z serwera (whitelist IP), a nie bezpośrednio z przeglądarki. Token generujemy pomyślnie z api-cpa.gov.pl, ale samo api.cepik.gov.pl blokuje CORS.</div>`
    }
    <div style="font-size:12px;font-weight:600;color:#633806;margin-bottom:8px">Inne rozwiązania:</div>
    <div style="font-size:11px;color:#7a4a06;line-height:2">
      <div><strong>1. CF Worker (wbudowany)</strong> — proxy /api/cepik/* w taxorder-pro-api.adamus1000.workers.dev — aktywny automatycznie</div>
      <div><strong>2. Whitelist IP</strong> — złóż wniosek do mc@mc.gov.pl o dodanie IP Twojego serwera</div>
      <div><strong>3. Ręcznie</strong> — sprawdzaj na <a href="https://historiapojazdu.gov.pl" target="_blank" style="color:#633806">historiapojazdu.gov.pl</a> i wpisuj przez formularz OCR w zakładce OCR Dowody</div>
    </div>
    <div style="margin-top:10px">
      <div style="font-size:11px;font-weight:600;color:#633806;margin-bottom:4px">Własny URL proxy (opcjonalnie):</div>
      <div style="display:flex;gap:6px">
        <input id="cepik-proxy-inp" class="fi" placeholder="https://moj-serwer.pl/cepik-proxy" value="${esc(cepikProxy)}" style="flex:1">
        <button class="btn btn-amber" style="font-size:11px" onclick="saveCepikProxyInline()"><i class="ti ti-plug"></i>Użyj proxy</button>
      </div>
    </div>
  </div>`;
  if(returnStr) return html;
  const el=document.getElementById('cepik-single-result')||document.getElementById('cepik-batch-results');
  if(el) el.innerHTML=html;
}

function saveCepikProxyInline() {
  const url=document.getElementById('cepik-proxy-inp')?.value?.trim()||'';
  if(url){
    cepikProxy=url;
    localStorage.setItem('dt1_cepik_proxy',url);
    if(document.getElementById('cepik-proxy')) document.getElementById('cepik-proxy').value=url;
    toast('✓ Proxy zapisany — kolejne zapytania przez proxy');
  }
}

// --- Inicjalizacja CEPiK przy otwarciu zakładki ---
function initCepikPage() {
  // Zawsze wstaw klucze do pól formularza
  const keyInp  = document.getElementById('cepik-key');
  const secInp  = document.getElementById('cepik-secret');
  const proxyInp= document.getElementById('cepik-proxy');
  if(keyInp)   keyInp.value   = cepikConsumerKey    || localStorage.getItem('dt1_cepik_key')    || '';
  if(secInp)   secInp.value   = cepikConsumerSecret || localStorage.getItem('dt1_cepik_secret') || '';
  if(proxyInp) proxyInp.value = cepikProxy          || localStorage.getItem('dt1_cepik_proxy')  || '';

  // Status połączenia
  if(isCepikTokenValid()) {
    const remaining = Math.round((cepikTokenExpires - Date.now()) / 1000);
    updateCepikStatus('ok');
    showTokenBox(cepikToken, remaining);
    cepikLog(`✅ Połączono — token ważny przez ${Math.floor(remaining/60)} min ${remaining%60} sek`, 'ok');
  } else if(cepikConsumerKey) {
    updateCepikStatus('testing');
    cepikLog('🔄 Token wygasł lub brak — generuję nowy...', 'warn');
    // Auto-refresh w tle
    cepikRefreshToken();
  } else {
    updateCepikStatus('none');
  }

  // Ustawienia auto-weryfikacji
  const autoChk  = document.getElementById('cepik-auto-enable');
  const hourSel  = document.getElementById('cepik-auto-hour');
  const notifySel= document.getElementById('cepik-notify');
  if(autoChk)    autoChk.checked = cepikSettings.autoEnable || false;
  if(hourSel)    hourSel.value   = cepikSettings.autoHour   || 6;
  if(notifySel)  notifySel.value = cepikSettings.notify     || 'dmc';

  updateCepikStatsUI();
}


// ==================== KOBIZE REMINDER ====================
function _checkKobizeReminder() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const key   = `kobize_reminder_${year}`;
  if (month !== 3) return;
  if (localStorage.getItem(key)) return;

  const toast2 = document.createElement('div');
  toast2.id = '_kobize-reminder';
  toast2.style.cssText = 'position:fixed;bottom:100px;right:24px;z-index:9900;background:var(--bg2);border:1px solid var(--amber);border-radius:var(--radius-lg);padding:16px 20px;max-width:340px;box-shadow:0 4px 20px rgba(0,0,0,.2)';
  const _closeKobize = () => { toast2.remove(); localStorage.setItem(key,'ok'); };
  window._closeKobize = _closeKobize;
  toast2.innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:8px;color:var(--amber)">
      <i class="ti ti-leaf"></i>Przypomnienie KOBIZE ${year}
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px">
      Do <strong>31 marca ${year}</strong> należy złożyć roczne sprawozdanie o emisji CO₂ do KOBiZE. Eksportuj dane paliw z modułu Raporty.
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button onclick="_closeKobize()" style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:4px;background:none;cursor:pointer;color:var(--text2)">Zamknij</button>
      <button onclick="window.FuelImport?.exportKobize(${year-1});_closeKobize()" style="font-size:11px;padding:4px 10px;border:none;border-radius:4px;background:var(--amber);cursor:pointer;color:#000;font-weight:600"><i class="ti ti-download"></i>Eksport ${year-1}</button>
    </div>`;
  document.body.appendChild(toast2);
  setTimeout(() => { if (document.getElementById('_kobize-reminder')) _closeKobize(); }, 30000);
}

// ==================== I18N RE-RENDER ====================
// When the user switches language, refresh all dynamic content
document.addEventListener('i18nChanged', () => {
  if (typeof renderVeh === 'function')       renderVeh();
  if (typeof _renderFleetKpi === 'function') _renderFleetKpi();
  if (typeof updateCounters === 'function')  updateCounters();
  if (window.FleetReports) FleetReports.renderPage();
  if (window.I18n) I18n.renderSelector();
});

// ==================== INIT ====================

window.addEventListener('load', async () => {
  if(window.TaxOrderCompanies){
  await window.TaxOrderCompanies.syncToApp();
}
  // Obsługa callback z Profilu Zaufanego (hash: #pz_token=... lub #pz_error=...)
  if (window.location.hash.includes('pz_token=') || window.location.hash.includes('pz_error=')) {
    const handled = await _handlePzHashCallback();
    if (handled) return; // PZ wziął kontrolę nad inicjalizacją
  }

  // Sprawdź zapamiętaną sesję użytkownika
  const savedEmail = sessionStorage.getItem('dt1_user_email');
  if(savedEmail){
    const u=users.find(x=>x.email===savedEmail&&x.active);
    if(u){
      currentUser=u;
      window.currentUserId = u.id || null;
      document.getElementById('login-screen').style.display='none';
      document.getElementById('app').style.display='flex';
      document.getElementById('user-avatar').textContent=u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      document.getElementById('user-name').textContent=u.name;
      document.getElementById('user-role-lbl').textContent=ROLE_LABELS[u.role]||u.role;
      applyRoleAccess(u.role);
    }
  }
  renderDash();
  window.renderVeh();
  updateCounters();

  // PWA — rejestracja Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[SW]', e.message));
  }

  // Powiadomienia przeglądarkowe — po 3s (żeby dane floty zdążyły się załadować)
  setTimeout(() => {
    if (window.TaxOrderNotifications?.requestAndCheck) {
      window.TaxOrderNotifications.requestAndCheck();
    }
    if (window.TaxOrderDrivers?.init) window.TaxOrderDrivers.init().then(() => { if (typeof _renderDriversDash === 'function') _renderDriversDash(); });
    window.FinesModule?.load?.().then(() => { if (typeof _renderFinesDash === 'function') _renderFinesDash(); });
    _loadKarty().then(() => { if (typeof _renderFleetCardsDash === 'function') _renderFleetCardsDash(); });
    // Przypomnienie KOBIZE — co roku w marcu
    _checkKobizeReminder();
  }, 3000);

  // Badge walidacji
  setTimeout(()=>{
    const nip = tp('tp-nip');
    let errs = 0;
    if(!/^\d{10}$/.test(nip.replace(/[-\s]/g,''))) errs++;
    document.getElementById('badge-err').textContent = errs>0?errs:'✓';
    document.getElementById('badge-err').style.background = errs>0?'var(--red)':'var(--green)';
  }, 300);

  // ===== CEPiK AUTO-CONNECT =====
  // Zapisz klucze domyślne do localStorage jeśli nie ma
  if(!localStorage.getItem('dt1_cepik_key')) {
    localStorage.setItem('dt1_cepik_key',    cepikConsumerKey);
    localStorage.setItem('dt1_cepik_secret', cepikConsumerSecret);
  }

  // Uruchom auto-połączenie z CEPiK w tle (nie blokuje UI)
  if(false) setTimeout(async () => {
    try {
      if(isCepikTokenValid()) {
        // Token jest w localStorage i ważny — tylko zaplanuj refresh
        console.log('[CEPiK] Token ważny, planuję auto-refresh');
        const remaining = Math.round((cepikTokenExpires - Date.now()) / 1000);
        scheduleTokenRefresh(Math.max(remaining - 300, 60));
        updateCepikStatus('ok');
        cepikLog(`✅ Auto-connect: token ważny przez ${Math.floor(remaining/60)} min`, 'ok');
      } else {
        // Brak tokenu lub wygasł — generuj nowy
        console.log('[CEPiK] Generuję nowy token...');
        const data = await cepikGetToken(cepikConsumerKey, cepikConsumerSecret);
        cepikToken        = data.access_token;
        cepikTokenExpires = Date.now() + (data.expires_in || 3600) * 1000;
        localStorage.setItem('dt1_cepik_token',     cepikToken);
        localStorage.setItem('dt1_cepik_token_exp', String(cepikTokenExpires));
        scheduleTokenRefresh((data.expires_in || 3600) - 300);
        updateCepikStatus('ok');
        cepikLog(`✅ Auto-connect: nowy token wygenerowany (ważny ${Math.floor((data.expires_in||3600)/60)} min)`, 'ok');
        console.log('[CEPiK] Token OK, wygasa za', Math.floor((data.expires_in||3600)/60), 'min');

        // Pokaż status w zakładce jeśli jest otwarta
        const tokenBox = document.getElementById('cepik-token-box');
        const tokenDisp = document.getElementById('cepik-token-display');
        const tokenExp  = document.getElementById('cepik-token-expires');
        if(tokenBox)  tokenBox.style.display = 'block';
        if(tokenDisp) tokenDisp.value = cepikToken;
        if(tokenExp)  tokenExp.textContent = `(wygasa za ${Math.floor((data.expires_in||3600)/60)} min, auto-odświeżanie aktywne)`;
        const rb = document.getElementById('cepik-refresh-btn');
        if(rb) rb.style.display = '';
      }
    } catch(e) {
      console.warn('[CEPiK] Auto-connect nieudany:', e.message);
      cepikLog('⚠ Auto-connect: ' + e.message, 'warn');
      updateCepikStatus(e.message.includes('CORS')||e.message.includes('fetch') ? 'cors' : 'err');
    }

    // Sprawdź auto-weryfikację dzienną
    checkCepikAuto();
  }, 2000); // Start po 2 sek — żeby UI był już gotowy
});

// ─── PANEL ADMINA: BŁĘDY JS ──────────────────────────────────────────────────
function _errApi(path) {
  return `${window.CF_WORKER_URL || 'https://taxorder-pro-api.adamus1000.workers.dev'}${path}`;
}
function _errHeaders() {
  const t = localStorage.getItem('cf_token');
  return t ? { Authorization: 'Bearer ' + t } : {};
}
async function _errFetch(path, opts = {}) {
  const r = await fetch(_errApi(path), { headers: _errHeaders(), ...opts });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

const _ERR_TYPE_COLORS = { uncaught: '#dc2626', promise: '#ea580c', manual: '#6b7280' };

async function renderErrorsAdmin() {
  const wrap = document.getElementById('errors-admin-body');
  if (!wrap) return;
  wrap.innerHTML = '<p>Ładowanie…</p>';
  try {
    const data = await _errFetch('/api/errors?limit=200');
    if (!data?.rows?.length) {
      wrap.innerHTML = '<p style="color:var(--muted)">Brak zarejestrowanych błędów.</p>';
      const cnt = document.getElementById('errors-admin-count');
      if (cnt) cnt.textContent = '0';
      return;
    }
    const cnt = document.getElementById('errors-admin-count');
    if (cnt) cnt.textContent = data.total ?? data.rows.length;

    wrap.innerHTML = `
      <table class="data-table" style="font-size:.82rem">
        <thead><tr>
          <th>Czas</th><th>Typ</th><th>Błąd</th><th>URL</th><th>Firma</th><th>Analiza</th><th></th>
        </tr></thead>
        <tbody>
          ${data.rows.map(r => {
            const col = _ERR_TYPE_COLORS[r.error_type] || '#6b7280';
            return `<tr>
              <td style="white-space:nowrap">${esc(r.created_at?.substring(0,16)??'')}</td>
              <td><span style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:.75rem;font-weight:600;background:${col}22;color:${col}">${esc(r.error_type)}</span></td>
              <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.error_msg)}">${esc(r.error_msg)}</td>
              <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.url??'')}"><small>${esc((r.url||'').replace(/^https?:\/\/[^/]+/,''))}</small></td>
              <td><small>${esc(r.company_id??'–')}</small></td>
              <td>${r.github_issue_url && (r.github_issue_url||'').startsWith('https://') ? `<a href="${esc(r.github_issue_url)}" target="_blank" rel="noopener" style="font-size:.8rem">Issue ↗</a>` : r.analyzed ? '<span style="color:var(--muted);font-size:.8rem">✓ OK</span>' : ''}</td>
              <td><button class="btn-sm btn-ghost" onclick="deleteErrorLog('${esc(r.id)}')" title="Usuń">🗑</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    wrap.innerHTML = `<p style="color:#dc2626">Błąd: ${esc(e.message)}</p>`;
  }
}

async function deleteErrorLog(id) {
  if (!confirm('Usunąć ten wpis?')) return;
  try {
    await _errFetch(`/api/errors/${id}`, { method: 'DELETE' });
    toast('✓ Wpis usunięty');
    renderErrorsAdmin();
  } catch (e) {
    toast('⚠ ' + e.message, true);
  }
}

async function clearAllErrorLogs() {
  if (!confirm('Usunąć WSZYSTKIE zarejestrowane błędy?')) return;
  try {
    const data = await _errFetch('/api/errors?limit=500');
    for (const r of (data?.rows || [])) {
      await _errFetch(`/api/errors/${r.id}`, { method: 'DELETE' });
    }
    toast('✓ Wyczyszczono logi błędów');
    renderErrorsAdmin();
  } catch (e) {
    toast('⚠ ' + e.message, true);
  }
}
