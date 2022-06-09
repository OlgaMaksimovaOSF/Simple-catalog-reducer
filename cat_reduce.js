const fs = require('fs');
const path = require('path');

const {
    XMLParser,
    XMLBuilder,
    XMLValidator
} = require("fast-xml-parser");

const paths = {
    input: __dirname + '/input/',
    output: __dirname + '/output/'
};

const compileSF = _ => {
    fs.promises.readFile(path.resolve(paths.input, 'storefront_catalog.xml'))
    .then( data => {
        const parser = new XMLParser({
            ignoreAttributes: false
        });

        var VGIDs = [];

        var dataObj = parser.parse(data.toString())

        var categories = dataObj.catalog;

        var categoryIDs = categories.category.map(item => item['@_category-id']);

        var categoryAssignments = categories['category-assignment'];

        var newCategoryAssignments = [];

        categoryIDs.forEach(item => {
            let catID = item;
            let currentAssignments = categoryAssignments.filter(ca => ca['@_category-id'] == catID);

            if (currentAssignments.length > 14) currentAssignments.length = 14;

            newCategoryAssignments.push(currentAssignments);

            let assignedVGs = currentAssignments.map(assignment => assignment['@_product-id'])
            if (assignedVGs.length > 0) {
                VGIDs.push(assignedVGs)
            }
        });

        var masters = VGIDs.flat().map(item => item.split('-')[0])

        var uniques = Array.from(new Set(masters)).join(',');

        categories['category-assignment'] = newCategoryAssignments.flat();
        categories.recommendation.length = 0;

        const builder = new XMLBuilder({
            ignoreAttributes: false
        });

        var outputFile = builder.build(dataObj);

        fs.writeFile(path.resolve(paths.output, 'newStorefront.xml'), outputFile, _ => {
            console.log("SF catalog compiled");
        })

            fs.promises.writeFile('uniques.txt', uniques, _ => {
            console.log("Unique Variatio Group ID's filtered");
        })
        .then(_ => {
            fs.promises.readFile(__dirname + '/uniques.txt')
            .then(data => {
                return data.toString().split(',');
            }).then(ids => {
                compileMaster(ids);
                compilePB(ids);
                compileInventory(ids);
            })
        })
    })
}

const compileMaster = ids => {
    fs.readFile(path.resolve(paths.input, 'ikks_master_v0.xml'), function (err, data) {
        const parser = new XMLParser({
            ignoreAttributes: false
        });

        var res = parser.parse(data.toString())
        var {
            product
        } = res.catalog;

        var catAssignment = res.catalog['category-assignment']

        var newProduct = product.filter((element) => {
            return ids.indexOf(element['@_product-id'].split('-')[0]) > -1
        });

        var newCA = catAssignment.filter((element) => {
            return ids.indexOf(element['@_product-id'].split('-')[0]) > -1
        })

        res.catalog.product = newProduct;
        res.catalog['category-assignment'] = newCA;

        const builder = new XMLBuilder({
            ignoreAttributes: false
        });

        var outputFile = builder.build(res);

        fs.writeFile(path.resolve(paths.output, 'newMaster.xml'), outputFile, _ => {
            console.log("Master catalog compiled");
        })

    });
}

const compilePB = ids => {
    fs.readFile(path.resolve(paths.input, 'pb.xml'), (err, data) => {
        const parser = new XMLParser({
            ignoreAttributes: false
        });

        const builder = new XMLBuilder({
            ignoreAttributes: false
        });

        var pbObj = parser.parse(data.toString());

        var pbs = [...pbObj.pricebooks.pricebook];

        pbs.forEach(pb => {
            let tables = [...pb['price-tables']['price-table']];

            let newTables = tables.filter(item => ids.indexOf(item['@_product-id'].split('-')[0]) > -1);

            pb['price-tables']['price-table'] = newTables;
        });

        pbObj.pricebooks.pricebook = pbs;

        var outputFile = builder.build(pbObj);

        fs.writeFile(path.resolve(paths.output,'newPB.xml'), outputFile, _ => {
            console.log("PB compilation done!!!");
        });
    });
}

const compileInventory = ids => {
    fs.readFile(path.resolve(paths.input, 'inventory.xml'), (err, data) => {
        const parser = new XMLParser({
            ignoreAttributes : false
        });
    
        var invObj = parser.parse(data.toString());
    
        var {record} = invObj.inventory['inventory-list'].records;

        var recordFiltered = record.filter(item => {
            if (ids.indexOf(item['@_product-id'].split('-')[0]) > -1) {
                item['allocation-timestamp'] = '2022-06-05T12:03:31.000Z';
                item['allocation'] = '500';
                return true
            }
        })
    
        invObj.inventory['inventory-list'].records.record = recordFiltered;

        const builder = new XMLBuilder({
            ignoreAttributes: false
        });

        var outputFile = builder.build(invObj);

        fs.writeFile(path.resolve(paths.output, 'newInventory.xml'), outputFile, _ => {
            console.log("inventory compilation done!!!");
        });

    });
}

compileSF();
