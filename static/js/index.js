var response;

CODES = { 'node1': { 'code': '', 'title': '' },
          'node2': { 'code': '', 'title': '' } };

var queryImages = {};
var imageURLs = [];

// tells typeahead how to handle the user input (e.g. the get request params)
var pageNames = new Bloodhound({
    datumTokenizer: function(d) {
        return Bloodhound.tokenizers.whitespace(d.value);
    },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    limit: 30,
    remote: {
        url: '/page-names?query=%QUERY',
        filter: function(pageNames) {
            // Map the remote source JSON array to a JavaScript array
            return $.map(pageNames.results, function(page) {
                return {
                    value: page.title,
                    code: page.code
                };

            });
        }
    }
});

pageNames.initialize();

function clear_all() {
    $('input#start-node').val('');
    $('input#end-node').val('');
    $('.path').html('');
    $('svg').remove();
    queryImages = {};
}

function initImageURL(data) {

    var pageObject = data['query']['pages'];
    var htmlSnippets = {};

    Object.keys(pageObject).forEach(function(pageKey) {

        item = getThumbnail(pageObject, pageKey);

        if (item.title == CODES['node1']['title']) { node = 0; } else { node = 1; }

        html = makeHTMLSnippet(node, item.thumbnail, item.title);
        htmlSnippets[node] = html;

        console.log('item', item);
        addImage(item, node);
        // queryImages[item.title] = {'url': item.thumbnail,
        //                            'id': node,
        //                             'height': item.height,
        //                             'width': item.width};
        imageURLs[node] = {'title': item.title, 'thumbnail': item.thumbnail};

    });
    return htmlSnippets;
}

function addImage(item, node) {
    queryImages[item.title] = {'url': item.thumbnail,
                               'id': node,
                               'height': item.height,
                               'width': item.width};
}

function getThumbnail(pageObject, pageKey) {
    var page = pageObject[pageKey];
    var title = page['title'];

    var thumbnail, thWidth, thHeight;
    if ('thumbnail' in page) { // if wikipedia query returned a thumbnail
        thumbnail = page['thumbnail']['source'];
        thWidth = page['thumbnail']['width'];
        thHeight = page['thumbnail']['height'];
    } else { // else returns grumpycat
        thumbnail = '../static/images/cat.jpg';
        thWidth = 100;
        thHeight = 75;
    }

    var response = {'title': title,
                    'thumbnail': thumbnail,
                    'width': thWidth,
                    'height': thHeight};
    return response;
}

function pathImageURL(data, innerNodes) {

    var pageObject = data['query']['pages'];
    var counter = 1;

    Object.keys(pageObject).forEach(function(pageKey) {
        item = getThumbnail(pageObject, pageKey);
        addImage(item, counter);
        counter = counter + 1;
    });
   
}

function makeHTMLSnippet(node, thumbnail, title) {
    html = '<div class="page" id="page'+node.toString()+'">'+
       '<div class="squareimg"><img src='+thumbnail+'></div>'+
       '<div class="page-title">'+title+'</div></div>';
    return html;
}

function makeQueryURL(numPages, pagesParams) {
    var queryURL = 'http://en.wikipedia.org/w/api.php' +
                   '?action=query&format=json&redirects&prop=pageimages&' +
                   'pithumbsize=100px&pilimit=' + numPages + '&titles=' +
                   pagesParams + '&callback=?';
    return queryURL;
}

function decodeInput(d, node) {
    CODES[node]['code'] = d.code.toString();
    CODES[node]['title'] = d.value;
}

$(document).ready(function(e) {
    clear_all();
});

// event handler for the query submission
$('input#submit-query').click(function(e) {

	e.preventDefault();
    clear_all();

    var pagesParams = CODES['node1']['title'] + '|' + CODES['node2']['title'];
    var queryURL = makeQueryURL(numPages=2, pagesParams);
    console.log('USER INPUT:', pagesParams);

    $.getJSON(
        queryURL,
        function(data) {

            var htmlSnippets = initImageURL(data);
            var path = $('.path');
            // for each item in the sorted list, append its html to the path div
            Object.keys(htmlSnippets).forEach(function(node) {
                path.append(htmlSnippets[node]);
            });

            // insert a load animation gif in between the two floating heads
            $('#page0').after('<div class="page arrow loading" id="arrow1"></div>');
                
        });

	$.get(
		'/query',
		{'node1': CODES['node1']['code'], 'node2': CODES['node2']['code']},
		function(data) {

			response = JSON.parse(data); // decode the JSON
            $('.arrow').removeClass('loading'); // change arrow img

            console.log('RETURNED PATH:', response['path']);
            // // remove the start and end nodes from innerNodes
            var innerNodes = response['path'].slice(1, -1);

            if (0 < innerNodes.length) { // if there are intermediary nodes

                var numPages = innerNodes.length;

                var pagesParams;
                if (numPages > 1) {
                    pagesParams = innerNodes.join('|');
                } else { pagesParams = innerNodes; }

                var queryURL = makeQueryURL(numPages, pagesParams);

                $.getJSON(
                    queryURL,
                    function(data) {
                        queryImages[CODES['node2']['title']]['id'] = response['path'].length - 1;
                        pathImageURL(data, innerNodes); //updates queryImages
                        console.log('queryImages:',queryImages);
                        $('.path').html('');
                        drawGraph(response['results']); // graph the results
                    });
            }

		});
    
});


// sets up the typeahead on the two input fields
$('.scrollable-dropdown-menu .typeahead').typeahead(null, {
    name: 'pageNames',
    displayKey: 'value',
    source: pageNames.ttAdapter()
});

// records the values chosen for each field as a global var
$('#start-node').on('typeahead:selected typeahead:autocompleted', function (e, d) {
    decodeInput(d, 'node1');
});

$('#end-node').on('typeahead:selected typeahead:autocompleted', function (e, d) {
    decodeInput(d, 'node2');
});