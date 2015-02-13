/*
* BiSet
* A small framework for visual analytics with biclusters
* Author & Copyright: Maoyuan Sun
* contact: smaoyuan@vt.edu
* 
*
* This relies on:
* D3.js
*/

var biset = {
	VERSION: '1.00',

	// global settings
	// the vis canvas
	visCanvas: { width: 2560, height: 2650, inUse: 0 },
	// an individual entity in a list
	entity: { width: 260, height: 25, rdCorner: 5, freqWidth: 30 },
	// a list
	entList: { width: 260, height: 2650, gap: 80, topGap: 10, startPos: 0, count: 0 },
	// a bicluster in-between two lists
	bic: { 
		frameWidth: 60, 
		frameHStrokeWidth: 5,
		frameNStrokeWidth: 0, 
		frameHeight: 30,
		frameBorderWidth: 1.2, 
		frameRdCorner: 2, 
		innerRdCorner: 2, 
		count: 0 
	},
	// a bicluster list
	bicList: { width: 60, height: 2650 },
	// a connection link between two elements
	conlink: { nwidth: 0.8, hwidth: 2 },

	// color settings
	colors: {
		// entity normal
		entNormal: "rgba(78, 131, 232, 0.3)",
		// entity hover
		entHover: "rgba(78, 131, 232, 0.5)",
		// corelated entities
		entColRel: "rgba(228, 122, 30, 0.2)",
		// entity highlight
		entHighlight: "rgba(228, 122, 30, 0.4)",
		// entity frequency
		entFreColor: "rgba(22, 113, 229, 0.3)",
		// normal bic frame
		bicFrameColor: "rgba(0, 20, 20, 0.2)",
		// hovering the entity to highlight bic
		bicFramePreHColor: "rgba(252, 30, 36, 0.5)",
		// select entity to highlight bic
		bicFrameHColor: "rgba(45, 168, 75, 0.6)",
		// the border of the bic frame
		bicFrameBorderColor: "rgba(0, 0, 0, 0.6)",
		// normal line
		lineNColor: "rgba(0, 0, 0, 0.1)",
		// hover entity to show links
		linePreHColor: "rgba(252, 30, 36, 0.5)",
		// selecte entity to highlight links
		lineHColor: "rgba(0, 143, 135, 0.4)",
		lsortColor: "rgba(0,0,0,0)"
	}
}

var durations = {
	bicFrameTrans: 500,
	lnTrans: 250,
	colEntTrans: 0
}

// an array to store all links
var connections = [],
	biclusters = [],
	entLists = [],
	selectedEnts = [];

// indicate dragging 
var draged = 0;

// a hash table to maintain the displayed bics
var bicDisplayed = [],
	// bicDisplayed = new Hashtable(),
	bicOnShow = [];

// canvas for visualizations
var canvas = d3.select("#biset_canvas")
	.append('svg')
	.attr('id', 'vis_canvas')
    .attr("width", biset.visCanvas.width)
    .attr('height', biset.visCanvas.height);


// for debug
$("svg").css({"border-color": "#C1E0FF", 
         "border":"0px", 
         "border-style":"solid"});

var svgPos = canvas[0][0].getBoundingClientRect(),
	svgCanvasOffset = { left: svgPos.left, top: svgPos.top };


var getOffset = function(element) {
        var $element = $(element[0][0]);
        return {
            left: $element.position().left,
            top: $element.position().top,
            width: element[0][0].getBoundingClientRect().width,
            height: element[0][0].getBoundingClientRect().height,
        };
    }

$('.selectpicker').selectpicker({
	style: 'btn-default',
	size: 10
});

// get dataset name
var selData = $('#selDataSet').val();
// to do get column names from the database about the dataset

$("#dataDimensionList").append(
	"<input type='checkbox' name='dimensions' value='person' id='d_person'> Person<br />" + 
	"<input type='checkbox' name='dimensions' value='location' id='d_location'> Location<br />" +
    "<input type='checkbox' name='dimensions' value='phone' id='d_phone'> Phone<br />" +
    "<input type='checkbox' name='dimensions' value='date' id='d_date'> Date<br />" +    
    "<input type='checkbox' name='dimensions' value='org' id='d_org'> Organization<br />" +
    "<input type='checkbox' name='dimensions' value='misc' id='d_misc'> Misc<br />"     
);


// drag function for a d3 object
biset.objDrag = d3.behavior.drag()
    .origin(function() {
    	// position of current selected item
    	thisOffset = getOffset(d3.select(this));
    	// position of the parent
    	parentOffset = getOffset(d3.select(this.parentNode));
    	return { x: thisOffset.left - parentOffset.left, y: thisOffset.top};
    })
    .on("dragstart", function (d) {
    	draged = 1;
        d3.event.sourceEvent.stopPropagation();
        d3.select(this).classed("dragging", true);
    })
    .on("drag", function (d) {
    	var dragX = d3.event.x,
    		dragY = d3.event.y;

    	// boundary check
		if (dragY < 0)
			dragY = 0;
		if (dragX >= biset.entList.gap * 2)
			dragX = biset.entList.gap * 2;
		if (dragX + biset.entList.gap * 2 <= 0)
			dragX = -biset.entList.gap * 2;
		// move the element
		d3.select(this).attr("transform", "translate(" + dragX + "," + dragY + ")");
		// update related lines
		biset.updateLink(connections);
    })
    .on("dragend", function (d) {
    	draged = 0;
    	biset.updateLink(connections);			            	
        d3.select(this).classed("dragging", false);			                
	});	


/*
* Add a list in a canvas and return this list
* @param canvas, the canvas for adding a list
* @param listData, data to generate the list
* @param bicList, the list of all bics
* @param startPos, position to draw bar
*/
biset.addList = function(canvas, listData, bicList, startPos) {
	
	// type of the list
	var type = listData.listType,
	// the list id
		listNum = listData.listID,
	// entities in the list
		entSet = listData.entities;

	// values of each entity
	var dataValues = [],
		dataFrequency = [],
		dataIndex = [];
		// id of all entities in a list with type
		// entIDList = [];
	for (var i = 0; i < entSet.length; i++) {
		dataValues.push(entSet[i].entValue);
		dataFrequency.push(entSet[i].entFreq);
		dataIndex.push(entSet[i].index);
		// entIDList.push(type + "_" + entSet[i].entityID);
	}

	// for (abic in bicList) {
	// 	console.log(bicList[abic]);
	// }

	dataValues.sort();

	// position for each entity in y-axis
	var y = d3.scale.ordinal()
	    .domain(dataValues)
	    .rangePoints([biset.entList.topGap, entSet.length * biset.entity.height + biset.entList.topGap], 0);

	var freIndicatorWidth = d3.scale.linear()
	    .domain([0, d3.max(dataFrequency)])
	    .range([3, biset.entity.freqWidth - 1]);	    

    // add control group of a list
    $("#biset_control").append("<div class='listControlGroup'>" +
    	"<h5 class='listTitle' id='listTitle_" + listNum + "'>" + type + "</h5> " +
    	"<span class='orderCtrlLabel glyphicon glyphicon-sort-by-alphabet' id='list_" + listNum + "_ctrl_label'></span>" + 
    	"<select class='orderCtrl' id='list_" + listNum + "_sortCtrl'>" + 
    		"<option value='alph'>alphabeic</option>" +
    		"<option value='freq'>frequency</option>" + 
		"</select>" + 
	"</div>");

	// console.log(entSet);
	// console.log(bicList);

	// add group to the svg
	var bar = canvas.selectAll("." + type)
    	.data(entSet)
  		.enter().append("g")
  		.attr('class', type)
  		.attr("id", function(d, i) { return type + "_" + d.entityID;})
  		.attr("transform", function(d, i) { return "translate(" + 1 + "," + y(d.entValue) + ")"; })
  		// mouseover event
    	.on("mouseover", function(d, i) {

    		// when dragging stops
    		if (draged == 0) {
	    		var frameID = d3.select(this).attr("id"),
	    			thisEntType = frameID.split("_")[0],
	    			thisListID = listData.listID;

	    		var entData = d3.select(this).data()[0],
	    			// all associated bic ids
	    			leftRelBicIDs = [],
	    			rightRelBicIDs = [];

	    		// change color when highlight
	    		if (biset.elementGetClass(this) != "entSelected") {
	    			var oriEntClass = biset.elementGetClass(this);
	    			d3.select("#" + frameID + "_frame").attr("fill", biset.colors.entHover);
	    			var nEntClass = oriEntClass + " entHover";
	    			biset.elementSetClass(this, nEntClass);

					// 1st list
					if (thisListID == 1) {
						if (entData.bicSetsRight != null) {
							for (var i = 0; i < entData.bicSetsRight.length; i++)
								rightRelBicIDs.push(entData.bicSetsRight[i]);

							// update when hovering
							hoverUpdateAll(bicList, rightRelBicIDs, frameID, "MouseOver");
						}
					}
					// 2nd list
					else {
						if (entData.bicSetsLeft != null) {
							for (var i = 0; i < entData.bicSetsLeft.length; i++)
								leftRelBicIDs.push(entData.bicSetsLeft[i]);

							// update when hovering
							hoverUpdateAll(bicList, leftRelBicIDs, frameID, "MouseOver");
						}
					}
	    		}
    		}

    	})
		// mouseout event handler
    	.on("mouseout", function() {

    		var frameID = d3.select(this).attr("id"),
    			thisEntType = frameID.split("_")[0],
    			thisListID = listData.listID;

    		var entData = d3.select(this).data()[0],
    			// all associated bic ids
    			leftRelBicIDs = [],
    			rightRelBicIDs = [];

    		// change color when highlight
    		if (biset.elementGetClass(this).indexOf("entHover") > 0) {
    			d3.select("#" + frameID + "_frame").attr("fill", biset.colors.entNormal);
    			var movEntClass = biset.elementGetClass(this);
    				motEntClass = movEntClass.split(" ")[0];

    			biset.elementSetClass(this, motEntClass);

				// 1st list
				if (thisListID == 1) {
					if (entData.bicSetsRight != null) {
						for (var i = 0; i < entData.bicSetsRight.length; i++)
							rightRelBicIDs.push(entData.bicSetsRight[i]);

						// update when hovering out
						hoverUpdateAll(bicList, rightRelBicIDs, frameID, "MouseOut");
					}
				}
				// 2nd list
				else {
					if (entData.bicSetsLeft != null) {
						for (var i = 0; i < entData.bicSetsLeft.length; i++)
							leftRelBicIDs.push(entData.bicSetsLeft[i]);

						// update when hovering out
						hoverUpdateAll(bicList, leftRelBicIDs, frameID, "MouseOut");
					}
				}
			}
    	})
		// click event handler for entities
		.on("click", function() {

    		var frameID = d3.select(this).attr("id"),
    			thisEntType = frameID.split("_")[0],
    			thisListID = listData.listID;

    		var entData = d3.select(this).data()[0],
    			// all associated bic ids
    			leftRelBicIDs = [],
    			rightRelBicIDs = [];

			var requestVal = d3.select(this).data()[0].entValue,
				requestJSON = { "query": requestVal }

			// search entity from wiki and retrieve results
			// visCtrlRequest(requestJSON, "wikisummary");
			
			var csrftoken = $('#csrf_token').val();

			// retrieve information from Wiki
			$.ajax({
		        url: window.SERVER_PATH + 'wiki/wikisummary/',
		        type: "POST",
		        data: JSON.stringify(requestJSON),
		        contentType: "application/json",
		        success: function(data){
		        	var sumtxt = data.sumtxt,
		        		optiontxt = data.option,
		        		empTxt = data.empty;

	        		$("#vis_wiki_title").html(requestVal);

	        		if (sumtxt.length != 0)
	        			$("#vis_wiki_text").html(sumtxt);
	        		else {
	        			if (optiontxt.length != 0) {
	        				var text = "Do you mean: " + optiontxt[0] + ", or "  + optiontxt[1] + "?";
		        			$("#vis_wiki_text").html(text);
	        			}
	        			else {
	        				$("#vis_wiki_text").html(empTxt);
	        			}
	        		}
		        },
		        beforeSend: function(xhr, settings) {
		            if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
		                xhr.setRequestHeader("X-CSRFToken", csrftoken);
		            }
		        }
		    });

    		// change color when highlight
    		if (biset.elementGetClass(this) != "entSelected") {
    			d3.select("#" + frameID + "_frame")
    				.attr("fill", biset.colors.entHighlight)
    				.attr("stroke-width", biset.bic.frameBorderWidth)
    				.attr("stroke", biset.colors.bicFrameBorderColor);
				biset.elementSetClass(this, "entSelected");

    			var thisEntID = d3.select(this).attr("id");
    			selectedEnts.push(thisEntID);

				// 1st list
				if (thisListID == 1) {
					if (entData.bicSetsRight != null) {
						for (var i = 0; i < entData.bicSetsRight.length; i++)
							rightRelBicIDs.push(entData.bicSetsRight[i]);

						// update when clicking
						hoverUpdateAll(bicList, rightRelBicIDs, frameID, "ClickHlight");

						// 	// record the bic has been clicked
						// 	bicDisplayed[bicIDVal] += 1;

						console.log(d3.selectAll(".entSelected"));
						var selEnts = d3.selectAll(".entSelected");
						console.log(selEnts[0].length);
						for (var i = 0; i < selEnts[0].length; i++) {
							// console.log(d3.select(selEnts[0][i]).attr("id"));
							var entDomain = d3.select(selEnts[0][i]).attr("id").split("_")[0];
							// console.log(entDomain);
						}
						// console.log(thisEntType);
						// console.log(entSet);

					}
				}
				// 2nd list
				else {
					if (entData.bicSetsLeft != null) {
						for (var i = 0; i < entData.bicSetsLeft.length; i++)
							leftRelBicIDs.push(entData.bicSetsLeft[i]);

						// update when clicking
						hoverUpdateAll(bicList, leftRelBicIDs, frameID, "ClickHlight");

							// record the bic has been clicked
							// bicDisplayed[bicIDVal] += 1;
					}
				}
    		}
    		else {
    			// unhighlight the element
    			d3.select("#" + frameID + "_frame")
    				.attr("fill", biset.colors.entNormal)
    				.attr("stroke-width", 0);
				// change class to the original class
				biset.elementSetClass(this, thisEntType);

				// 1st list
				if (thisListID == 1) {
					if (entData.bicSetsRight != null) {
						for (var i = 0; i < entData.bicSetsRight.length; i++)
							rightRelBicIDs.push(entData.bicSetsRight[i]);

						for (var i = 0; i < rightRelBicIDs.length; i++) {
							var rowListIDs = bicList[rightRelBicIDs[i]].row,
								colListIDs = bicList[rightRelBicIDs[i]].col,
								rowField = bicList[rightRelBicIDs[i]].rowField,
								colField = bicList[rightRelBicIDs[i]].colField,
								thisBicID = "bic_" + rightRelBicIDs[i],
								thisBicFrameID = "bic_frame_" + rightRelBicIDs[i];

							bicFrameUpdate("#" + thisBicFrameID, biset.colors.bicFrameColor, 
								biset.bic.frameNStrokeWidth, durations.bicFrameTrans);

							// update the row
							for (var j = 0; j < rowListIDs.length; j++) {
								linkStateUpdate("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID, 
									biset.colors.lineNColor, biset.conlink.nwidth, "linkNormal", durations.lnTrans);

								if (rowField + "_" + rowListIDs[j] != frameID){
									colEntUpdate("#" + rowField + "_" + rowListIDs[j] + "_frame", 
										biset.colors.entNormal, thisEntType, durations.colEntTrans);

									d3.select("#" + rowField + "_" + rowListIDs[j])
										.attr("class", thisEntType);
								}
							}

							// update the column
							for (var k = 0; k < colListIDs.length; k++) {
								linkStateUpdate("#" + thisBicID + "__" + colField + "_" + colListIDs[k], 
									biset.colors.lineNColor, biset.conlink.nwidth, "linkNormal", durations.lnTrans);

								if (colField + "_" + colListIDs[k] != frameID) {
									colEntUpdate("#" + colField + "_" + colListIDs[k] + "_frame", 
										biset.colors.entNormal, thisEntType, durations.colEntTrans);

									d3.select("#" + colField + "_" + colListIDs[k])
										.attr("class", thisEntType);
								}
							}

						}
					}
				}
				// 2nd list
				else {
					if (entData.bicSetsLeft != null) {
						for (var i = 0; i < entData.bicSetsLeft.length; i++)
							leftRelBicIDs.push(entData.bicSetsLeft[i]);

						for (var i = 0; i < leftRelBicIDs.length; i++) {
		    				var rowListIDs = bicList[leftRelBicIDs[i]].row,
		    					colListIDs = bicList[leftRelBicIDs[i]].col,
		    					rowField = bicList[leftRelBicIDs[i]].rowField,
		    					colField = bicList[leftRelBicIDs[i]].colField,
		    					bicIDVal = leftRelBicIDs[i],
		    					thisBicID = "bic_" + leftRelBicIDs[i],
		    					thisBicFrameID = "bic_frame_" + leftRelBicIDs[i];

							bicFrameUpdate("#" + thisBicFrameID, biset.colors.bicFrameColor, 
								biset.bic.frameNStrokeWidth, durations.bicFrameTrans);

							// update the row
							for (var j = 0; j < rowListIDs.length; j++) {
								linkStateUpdate("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID, 
									biset.colors.lineNColor, biset.conlink.nwidth, "linkNormal", durations.lnTrans);

								if (rowField + "_" + rowListIDs[j] != frameID){
									colEntUpdate("#" + rowField + "_" + rowListIDs[j] + "_frame", 
										biset.colors.entNormal, thisEntType, durations.colEntTrans);

									d3.select("#" + rowField + "_" + rowListIDs[j])
										.attr("class", thisEntType);
								}
							}

							// update the column
							for (var k = 0; k < colListIDs.length; k++) {
								linkStateUpdate("#" + thisBicID + "__" + colField + "_" + colListIDs[k], 
									biset.colors.lineNColor, biset.conlink.nwidth, "linkNormal", durations.lnTrans);

								if (colField + "_" + colListIDs[k] != frameID) {
									colEntUpdate("#" + colField + "_" + colListIDs[k] + "_frame", 
										biset.colors.entNormal, thisEntType, durations.colEntTrans);

									d3.select("#" + colField + "_" + colListIDs[k])
										.attr("class", thisEntType);
								}
							}

	    				}
					}
				}



    // 			// remove the element from the selected list
    // 			var bicIndex = selectedEnts.indexOf(frameID);
    // 			if (bicIndex > -1) {
				//     selectedEnts.splice(bicIndex, 1);
				// }

				// // 1st list
				// if (thisListID == 1) {
				// 	if (entData.bicSetsRight != null) {
				// 		for (var i = 0; i < entData.bicSetsRight.length; i++){
				// 			rightRelBicIDs.push(entData.bicSetsRight[i]);
				// 		}

				// 		for (var i = 0; i < rightRelBicIDs.length; i++) {
		  //   				var rowListIDs = bicList[rightRelBicIDs[i]].row,
		  //   					colListIDs = bicList[rightRelBicIDs[i]].col,
		  //   					rowField = bicList[rightRelBicIDs[i]].rowField,
		  //   					colField = bicList[rightRelBicIDs[i]].colField,
		  //   					bicIDVal = rightRelBicIDs[i],
		  //   					thisBicID = "bic_" + rightRelBicIDs[i];


	   //  					if (bicDisplayed[bicIDVal] == 1) {
				// 				d3.select("#" + thisBicID)
				// 					.classed("bicSelected", false)
				// 					// .style("opacity", 100);
				// 					.style("display", "none");

			 //    				for (var j = 0; j < rowListIDs.length; j++) {
			 //    					d3.select("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID)
				// 						.classed("linkSelected", false)
				// 						// .style("opacity", 100);
			 //    						.style("display", "none");
			 //    				}

			 //    				for (var k = 0; k < colListIDs.length; k++) {
			 //    					d3.select("#" + thisBicID + "__" + colField + "_" + colListIDs[k])
			 //    						.classed("linkSelected", false)
			 //    						// .style("opacity", 100);
			 //    						.style("display", "none");
			 //    				}
	   //  					}

				// 			// record the bic has been unselected
				// 			bicDisplayed[bicIDVal] -= 1;
				// 		}
				// 	}
				// }
				// // 2nd list
				// else {
				// 	if (entData.bicSetsLeft != null) {
				// 		for (var i = 0; i < entData.bicSetsLeft.length; i++){
				// 			leftRelBicIDs.push(entData.bicSetsLeft[i]);
				// 		}

				// 		for (var i = 0; i < leftRelBicIDs.length; i++) {
		  //   				var rowListIDs = bicList[leftRelBicIDs[i]].row,
		  //   					colListIDs = bicList[leftRelBicIDs[i]].col,
		  //   					rowField = bicList[leftRelBicIDs[i]].rowField,
		  //   					colField = bicList[leftRelBicIDs[i]].colField,
		  //   					bicIDVal = leftRelBicIDs[i],
		  //   					thisBicID = "bic_" + leftRelBicIDs[i];

	   //  					if (bicDisplayed[bicIDVal] == 1) {
				// 				d3.select("#" + thisBicID)
				// 					.classed("bicSelected", false)
				// 					// .style("opacity", 100);
				// 					.style("display", "none");

				// 				// record the bic has been clicked
				// 				bicDisplayed[bicIDVal] += 1;

			 //    				for (var j = 0; j < rowListIDs.length; j++) {
			 //    					d3.select("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID)
			 //    						.classed("linkSelected", false)
			 //    						// .style("opacity", 100);
			 //    						.style("display", "none");
			 //    				}

			 //    				for (var k = 0; k < colListIDs.length; k++) {
			 //    					d3.select("#" + thisBicID + "__" + colField + "_" + colListIDs[k])
			 //    						.classed("linkSelected", false)
			 //    						// .style("opacity", 100);
			 //    						.style("display", "none");
			 //    				}	    						
	   //  					}
				// 			// record the bic has been unselected
				// 			bicDisplayed[bicIDVal] -= 1;
				// 		}
				// 	}
				}
    // 		}  		
  		});

	// add texts for each entity
	var viewText = bar.append("text")
	    .attr("x", biset.entity.width / 6)
	    .attr("y", biset.entity.height / 2)
	    .attr("dy", ".35em")
	    .text(function(d) { return d.entValue; });

	// add bar for each entity
	var entityFreIndicator = bar.append("rect")
	    .attr("width", function(d, i) { return freIndicatorWidth(d.entFreq); })
	    .attr("height", biset.entity.height - 1)
	    .attr("rx", biset.entity.rdCorner)
	    .attr("ry", biset.entity.rdCorner)
	    .attr("id", function(d, i) { return type + "_" + d.entityID + "_freq";})
	    .attr("fill", biset.colors.entFreColor);	    

	// add bar for each entity
	var entityFrame = bar.append("rect")
		.datum(function(d) { return d; })
	    .attr("width", biset.entity.width)
	    .attr("height", biset.entity.height - 1)
	    .attr("rx", biset.entity.rdCorner)
	    .attr("ry", biset.entity.rdCorner)
	    .attr("id", function(d, i) { return type + "_" + d.entityID + "_frame";})
	    .attr("class", "bicFrame")
	    .attr("fill", biset.colors.entNormal);    	

	// for an object for this list
	var listView = {
		"id": "list_" + listNum,
		"dataType": type,
		"relatedDataSet": listData,
		"startPos": startPos,
		"yAxis": y,
		"entGroups": bar,
		"entities": entityFrame,
		"texts": viewText
	}
    return listView;	    
}


/*
* function to update the color of a bic frame
* @param frameID, the ID of the bic frame
* @param newColor, the new color of the frame
* @param newStrokeWidth, the new stroke width of the frame
* @param timer, the duration for the update
*/
function bicFrameUpdate(frameID, newColor, newStrokeWidth, durTimer) {
	d3.select(frameID)
		.transition()
		.style("stroke", newColor)
		.style("stroke-width", newStrokeWidth)
		.duration(durTimer);
}


/*
* function to update the color of links
* @param linkID, the ID of the link
* @param newColor, the new color of the link
* @param newWidth, the new width of the link
* @param newClass, the new class of the link
* @param timer, the duration for the update
*/
function linkStateUpdate(linkID, newColor, newWidth, newClass, durTimer) {
	d3.select(linkID)
		.transition()
		.style("stroke", newColor)
		.style("stroke-width", newWidth)
		.attr("class", newClass)
		.duration(durTimer);
}


/*
* function to update the color of correlated entities
* @param entID, the ID of correlated entities
* @param newColor, the new color of the link
* @param newClass, the new class of the link
* @param timer, the duration for the update
*/
function colEntUpdate(entID, newColor, newClass, durTimer) {
	d3.select(entID)
		.transition()
		.attr("fill", newColor)
		.attr("class", newClass)
		.duration(durTimer);
}


/*
* function to update bics and links when hovering and out
* @param aBicList, a list of bic
* @param aBicIDList, a list of bicID
* @param theBicFrameID, the frameID of hovered bic
* @param eventType, the event to triger the update
*/
function hoverUpdateAll(aBicList, aBicIDList, theBicFrameID, eventType) {
	for (var i = 0; i < aBicIDList.length; i++) {
		var rowListIDs = aBicList[aBicIDList[i]].row,
			colListIDs = aBicList[aBicIDList[i]].col,
			rowField = aBicList[aBicIDList[i]].rowField,
			colField = aBicList[aBicIDList[i]].colField,
			thisBicID = "bic_" + aBicIDList[i],
			thisBicFrameID = "bic_frame_" + aBicIDList[i];

		// mouseover highlight
		if (eventType == "MouseOver") {
			bicFrameUpdate("#" + thisBicFrameID, biset.colors.bicFramePreHColor, 
				biset.bic.frameHStrokeWidth, durations.bicFrameTrans);

			// update the row
			for (var j = 0; j < rowListIDs.length; j++) {
				linkStateUpdate("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID, 
					biset.colors.linePreHColor, biset.conlink.hwidth, "lineMHight", durations.lnTrans);

				if (rowField + "_" + rowListIDs[j] != theBicFrameID
					&& d3.select("#" + rowField + "_" + rowListIDs[j]).attr("class") != "entSelected")
					colEntUpdate("#" + rowField + "_" + rowListIDs[j] + "_frame", 
						biset.colors.entColRel, "entMHight", durations.colEntTrans);
			}

			// update the column
			for (var k = 0; k < colListIDs.length; k++) {
				linkStateUpdate("#" + thisBicID + "__" + colField + "_" + colListIDs[k], 
					biset.colors.linePreHColor, biset.conlink.hwidth, "lineMHight", durations.lnTrans);

				if (colField + "_" + colListIDs[k] != theBicFrameID
					&& d3.select("#" + colField + "_" + colListIDs[k]).attr("class") != "entSelected")
					colEntUpdate("#" + colField + "_" + colListIDs[k] + "_frame", 
						biset.colors.entColRel, "entMHight", durations.colEntTrans);
			}
		}
		// mouseout unhighlight
		else if (eventType == "MouseOut") {
			bicFrameUpdate("#" + thisBicFrameID, biset.colors.bicFrameColor, 
				biset.bic.frameNStrokeWidth, durations.bicFrameTrans);

			for (var j = 0; j < rowListIDs.length; j++) {
				if (d3.select("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID).attr("class") != "linkSelected")
					linkStateUpdate("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID, 
						biset.colors.lineNColor, biset.conlink.nwidth, "lineNormal", durations.lnTrans);

				if (rowField + "_" + rowListIDs[j] != theBicFrameID
					&& d3.select("#" + rowField + "_" + rowListIDs[j]).attr("class") != "entSelected")
					colEntUpdate("#" + rowField + "_" + rowListIDs[j] + "_frame", 
						biset.colors.entNormal, "entNormal", durations.colEntTrans);
			}

			for (var k = 0; k < colListIDs.length; k++) {
				if (d3.select("#" + thisBicID + "__" + colField + "_" + colListIDs[k]).attr("class") != "linkSelected")
					linkStateUpdate("#" + thisBicID + "__" + colField + "_" + colListIDs[k], 
						biset.colors.lineNColor, biset.conlink.nwidth, "lineNormal", durations.lnTrans);

				if (colField + "_" + colListIDs[k] != theBicFrameID
					&& d3.select("#" + colField + "_" + colListIDs[k]).attr("class") != "entSelected")
					colEntUpdate("#" + colField + "_" + colListIDs[k] + "_frame", 
						biset.colors.entNormal, "entNormal", durations.colEntTrans);
			}
		}
		// click highlight
		else if (eventType == "ClickHlight") {
			bicFrameUpdate("#" + thisBicFrameID, biset.colors.bicFrameHColor, 
				biset.bic.frameHStrokeWidth, durations.bicFrameTrans);

			// update the row
			for (var j = 0; j < rowListIDs.length; j++) {
				// linkStateUpdate("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID, 
				// 	color.lineNColor, ln.nwidth, "lineNormal", durations.lnTrans);
				linkStateUpdate("#" + rowField + "_" + rowListIDs[j] + "__" + thisBicID, 
					biset.colors.lineHColor, biset.conlink.hwidth, "linkSelected", durations.lnTrans);

				if (rowField + "_" + rowListIDs[j] != theBicFrameID){
					// colEntUpdate("#" + rowField + "_" + rowListIDs[j] + "_frame", 
					// 	color.entNormal, durations.colEntTrans);
					colEntUpdate("#" + rowField + "_" + rowListIDs[j] + "_frame", 
						biset.colors.entHighlight, "entSelected", durations.colEntTrans);

					d3.select("#" + rowField + "_" + rowListIDs[j])
						.attr("class", "entSelected");
				}
			}

			// update the column
			for (var k = 0; k < colListIDs.length; k++) {
				// linkStateUpdate("#" + thisBicID + "__" + colField + "_" + colListIDs[k], 
				// 	color.lineNColor, ln.nwidth, "lineNormal", durations.lnTrans);
				linkStateUpdate("#" + thisBicID + "__" + colField + "_" + colListIDs[k], 
					biset.colors.lineHColor, biset.conlink.hwidth, "linkSelected", durations.lnTrans);

				if (colField + "_" + colListIDs[k] != theBicFrameID) {
					// colEntUpdate("#" + colField + "_" + colListIDs[k] + "_frame", 
					// 	color.entNormal, durations.colEntTrans);
					colEntUpdate("#" + colField + "_" + colListIDs[k] + "_frame", 
						biset.colors.entHighlight, "entSelected", durations.colEntTrans);

					d3.select("#" + colField + "_" + colListIDs[k])
						.attr("class", "entSelected");
				}
			}
		}

		// else if (eventType == "ClickUHlight") {
		// }
	}	
}


biset.addBics = function(preListCanvas, bicListCanvas, listData, bicList, bicStartPos, row, col) {    		
		// ratio between row and column
	var // bicRowPercent = [],
		// total entities in bics
		bicTotalEnts = [],
		// # of left ents in a bic
		bicLeftEnts = [];

	for (key in bicList) {
		var entNumInRow = bicList[key].row.length,
			entNumInCol = bicList[key].col.length,
			// tmpRatio = entNumInRow / (entNumInRow + entNumInCol),
			tmpSum = entNumInRow + entNumInCol;
		// ratio of each bic
		// bicRowPercent.push(tmpRatio);

		bicTotalEnts.push(tmpSum);
		// tmpTotalEnts.push(tmpSum);
		bicLeftEnts.push(entNumInRow);

		if (bicList[key].rowField == row && bicList[key].colField == col)
			// get all biclusters
			biclusters.push(bicList[key]);
	}

	var bicEntsMin = Array.min(bicTotalEnts),
		bicEntsMax = Array.max(bicTotalEnts);

	// visual percentage based on ratio
	// var bicRatio = d3.scale.linear()
	//     .domain([0, 1])
	//     .range([1, biset.bic.frameWidth]);

    // visual percentage based on the count
	var bicEntsCount = d3.scale.linear()
		.domain([0, bicEntsMax])
		.range([0, biset.bic.frameWidth]);	

    // add all bics
	var bics = bicListCanvas.selectAll(".bics")
		.data(biclusters)
		.enter().append("g")
		.attr("id", function(d, i) { return "bic_" + d.bicID; })
		.attr("class", "bics")
  		.attr("transform", function(d, i) {
  			return "translate(" + 0 + "," + (i + 1) * biset.bic.frameHeight + ")"; 
  		});

	// proportion of row
	bics.append("rect")
  		.attr("id", function(d, i) { return "bic_left_" + d.bicID; })
	    .attr("width", function(d, i) { return bicEntsCount(bicLeftEnts[i]); })
	    // .attr("width", function(d, i) { return bicRatio(bicRowPercent[i]); })
	    .attr("height", biset.entity.height - 1)
	    .attr("rx", biset.bic.innerRdCorner)
	    .attr("ry", biset.bic.innerRdCorner)
	    .attr("fill", biset.colors.entFreColor);

	// 100% proportion
	bics.append("rect")
		.attr("id", function(d, i) { return "bic_frame_" + d.bicID; })
		.attr("width", function(d, i) { return bicEntsCount(bicTotalEnts[i]); })
	    // .attr("width", bic.frameWidth)
	    .attr("height", biset.entity.height - 1)
	    .attr("rx", biset.bic.frameRdCorner)
	    .attr("ry", biset.bic.frameRdCorner)
	    .attr("fill", biset.colors.bicFrameColor);	      			

    for (var i = 0; i < biclusters.length; i++) {
    	// console.log(biclusters[i]);
    	var rowType = biclusters[i].rowField,
    		colType = biclusters[i].colField,
    		rowIDs = biclusters[i].row,
    		colIDs = biclusters[i].col,
    		bicID = biclusters[i].bicID;

		for (var j = 0; j < rowIDs.length; j++) {
			var obj1 = d3.select("#" + rowType + "_" + rowIDs[j]);
				obj2 = d3.select("#bic_" + bicID);

			// append lines to previous list g
			connections.push(biset.addLink(obj1, obj2, biset.colors.lineNColor, canvas));
			// obj2.attr({cursor: "move"});
			obj2.call(biset.objDrag);
		}

		for (var k = 0; k < colIDs.length; k++) {
			var obj1 = d3.select("#bic_" + bicID),
				obj2 = d3.select("#" + colType + "_" + colIDs[k]);

			// append lines to previous list g
			connections.push(biset.addLink(obj1, obj2, biset.colors.lineNColor, canvas));
			// obj2.attr({cursor: "move"});
			obj1.call(biset.objDrag);
		}
    }

    // hide bics for mouse over
    // we should hide bics after adding the line, 
    // since the pos of line is determined by that of bics
    // d3.selectAll(".bics");
    	// .style("opacity", 0);
		// .style("display", "none");
}


// when all d3 transition finish, and then do the callback
function endall(transition, callback) { 
	var n = 0; 
	transition 
	    .each(function() { ++n; }) 
	    .each("end", function() { if (!--n) callback.apply(this, arguments); }); 
}


/*
* sort a list visually
* @param aList, svg objects in a list selected by d3 with associated data
* @param sortType, sorting orders
*/
function sortList(aList, sortType) {
	// get all entities
	var entSet = aList.relatedDataSet.entities;

	// values of each entity
	var dataValues = [],
		// dataFrequency = [],
		dataIndex = [];
	for (var i = 0; i < entSet.length; i++) {
		dataValues.push(entSet[i].entValue);
		// dataFrequency.push(entSet[i].entFreq);
		dataIndex.push(entSet[i].index);
	}

	// hide the selected line
	d3.selectAll(".linkSelected").transition()
		.delay(150)
		.style("stroke", biset.colors.lsortColor);

	// sort by frequency
	if (sortType == "freq") {
		dataIndex.sort(function(a, b) { return a - b; });

		aList.yAxis.domain(dataIndex);
		// dataFrequency.sort(function(a, b) { return b - a; });
		// new positions for each entity
		// aList.yAxis.domain(dataFrequency);

		// move entities to their new position

		aList.entGroups.transition()
			.duration(650)
			.delay(function(d, i) { return i * 15; })
			.attr("transform", function(d, i) {
				// return "translate(" + aList.startPos + "," + aList.yAxis(d.index) + ")";
				return "translate(0," + aList.yAxis(d.index) + ")";
			})

			.call(endall, function() {
				biset.updateLink(connections);

				// hide the selected line
				d3.selectAll(".linkSelected").transition()
					.delay(150)
					.style("stroke", biset.colors.lineNColor);
			});
	}

	// sort by alphabeic order
	if (sortType == "alph") {
		dataValues.sort();
		// new positions for each entity
		aList.yAxis.domain(dataValues);

		// move entities to their new position
		aList.entGroups.transition()
			.duration(750)
			.delay(function(d, i) { return i * 15; })
			.attr("transform", function(d, i) {
				return "translate(0," + aList.yAxis(d.entValue) + ")";
				// return "translate(" + aList.startPos + "," + aList.yAxis(d.entValue) + ")";				 
			})
			.call(endall, function() { 
			    biset.updateLink(connections);

				// hide the selected line
				d3.selectAll(".linkSelected").transition()
					.delay(10)
					.style("stroke", biset.colors.lineNColor);
			});
	}
}


/*
* Add sorting event handler to the dropdown
* @param listView, new added list
*/
function addSortCtrl(listView) {
	// sort a list by selected value
	$("#" + listView.id + "_sortCtrl").change(function() {
		var orderBy = $(this).val();
		if (orderBy == 'freq') {
			$("#" + listView.id + "_ctrl_label")
				.removeClass('glyphicon-sort-by-alphabet')
				.addClass('glyphicon-sort-by-attributes-alt');
		}
		if (orderBy == 'alph') {
			$("#" + listView.id + "_ctrl_label")
				.removeClass('class glyphicon-sort-by-attributes-alt')
				.addClass('glyphicon-sort-by-alphabet');
		}
		sortList(listView, orderBy);
	});
}

/*
* add a line
* reference: http://raphaeljs.com/graffle.html
* @param obj1, the 1st object
* @param obj2, the 2nd object
* @param d3obj, d3 object to append the line
* @param bg, 
*/
biset.addLink = function (obj1, obj2, line, d3obj, bg) {
    if (obj1.line && obj1.from && obj1.to) {
        line = obj1;
        obj1 = line.from;
        obj2 = line.to;
        d3obj = line.d3Canvas;
    }

    // var svgPos = d3obj[0][0].getBoundingClientRect();

    // var bb1 = obj1[0][0].getBoundingClientRect(),
    //     bb2 = obj2[0][0].getBoundingClientRect(),

    //     p = [{x: bb1.left + bb1.width / 2 - svgPos.left, y: bb1.top - 1 - svgPos.top},
    //     {x: bb1.left + bb1.width / 2 - svgPos.left, y: bb1.top + bb1.height + 1 - svgPos.top},
    //     {x: bb1.left - 1 - svgPos.left, y: bb1.top + bb1.height / 2 - svgPos.top},
    //     {x: bb1.left + bb1.width + 1 - svgPos.left, y: bb1.top + bb1.height / 2 - svgPos.top},
    //     {x: bb2.left + bb2.width / 2 - svgPos.left, y: bb2.top - 1 - svgPos.top},
    //     {x: bb2.left + bb2.width / 2 - svgPos.left, y: bb2.top + bb2.height + 1 - svgPos.top},
    //     {x: bb2.left - 1 - svgPos.left, y: bb2.top + bb2.height / 2 - svgPos.top},
    //     {x: bb2.left + bb2.width + 1 - svgPos.left, y: bb2.top + bb2.height / 2 - svgPos.top}],

	var bb1 = getOffset(obj1),
        bb2 = getOffset(obj2),

        p = [{x: bb1.left + bb1.width / 2, y: bb1.top - 1},
        {x: bb1.left + bb1.width / 2, y: bb1.top + bb1.height + 1},
        {x: bb1.left - 1, y: bb1.top + bb1.height / 2},
        {x: bb1.left + bb1.width + 1, y: bb1.top + bb1.height / 2},
        {x: bb2.left + bb2.width / 2, y: bb2.top - 1},
        {x: bb2.left + bb2.width / 2, y: bb2.top + bb2.height + 1},
        {x: bb2.left - 1 , y: bb2.top + bb2.height / 2},
        {x: bb2.left + bb2.width + 1, y: bb2.top + bb2.height / 2}],    
        d = {}, dis = [];

    for (var i = 0; i < 4; i++) {
        for (var j = 4; j < 8; j++) {
            var dx = Math.abs(p[i].x - p[j].x),
                dy = Math.abs(p[i].y - p[j].y);
            if ((i == j - 4) || (((i != 3 && j != 6) || p[i].x < p[j].x) && ((i != 2 && j != 7) || p[i].x > p[j].x) && ((i != 0 && j != 5) || p[i].y > p[j].y) && ((i != 1 && j != 4) || p[i].y < p[j].y))) {
                dis.push(dx + dy);
                d[dis[dis.length - 1]] = [i, j];
            }
        }
    }
    if (dis.length == 0) {
        var res = [0, 4];
    } else {
        res = d[Math.min.apply(Math, dis)];
    }
    var x1 = p[res[0]].x,
        y1 = p[res[0]].y,
        x4 = p[res[1]].x,
        y4 = p[res[1]].y;
    dx = Math.max(Math.abs(x1 - x4) / 2, 10);
    dy = Math.max(Math.abs(y1 - y4) / 2, 10);
    var x2 = [x1, x1, x1 - dx, x1 + dx][res[0]].toFixed(3),
        y2 = [y1 - dy, y1 + dy, y1, y1][res[0]].toFixed(3),
        x3 = [0, 0, 0, 0, x4, x4, x4 - dx, x4 + dx][res[1]].toFixed(3),
        y3 = [0, 0, 0, 0, y1 + dy, y1 - dy, y4, y4][res[1]].toFixed(3);
    var path = ["M" + x1.toFixed(3), y1.toFixed(3) + "C" + x2, y2, x3, y3, x4.toFixed(3), y4.toFixed(3)].join(",");  
    
    if (line && line.line) {
        //console.log(line.line.bg);
        //line.bg && line.bg.attr({path: path});
        line.line.attr("d", path);
    } else {
        // var color = typeof line == "string" ? line : "#000";
        return {      
            //bg: bg && bg.split && robj.path(path).attr({stroke: bg.split("|")[0], fill: "none", "stroke-width": bg.split("|")[1] || 3}),
            // default to be hide
            line: d3obj.append("path")
            		.attr("d", path)
            		.attr("id", function() { return obj1.attr("id") + "__" + obj2.attr("id")})
            		.attr("class", "lineNormal")
            		.style("stroke", biset.colors.lineNColor)
            		.style("stroke-width", biset.conlink.nwidth)
            		.style("fill", "none"),

            		// .style("display", "none"),

            		// .style({stroke: color.lineNColor, fill: "none", display:"none" }), // opacity: 0
            from: obj1,
            to: obj2,
            d3Canvas: d3obj            
        };
    }
};


/*
* update a set of links
* @param links, an array of links
*/
biset.updateLink = function(links) {
	for (lk in links)
		biset.addLink(links[lk]);
}


/* 
* reset all global parameters
*/
biset.globalParamClear = function() {
	connections = [];
	biclusters = [];
	entLists = [];
	selectedEnts = [];
	biset.entList.count = 0;
	biset.entList.startPos = 0;
	biset.bic.count = 0;
}


/* 
* remove all elements in current d3 canvas
* @param {object} thisCanvas, current d3 canvas
*/
biset.removeVis = function(thisCanvas) {
	thisCanvas.selectAll("*").remove();
	biset.visCanvas.inUse = 0;
	// remove sort control
	$('.listControlGroup').remove();	
}


/*
* Get the class of a html element by id
* @param {string} elementID, the id of a html element
* @return the class
*/
biset.elementGetClass = function(elementID) {
	return d3.select(elementID).attr("class");
}


/*
* Get the class of a html element by id
* @param {string} elementID, the id of a html element
* @param {string} className, the class name
*/
biset.elementSetClass = function(elementID, className) {
	d3.select(elementID).attr("class", className);
}


/*
* Get the max value in an array
* @param {int}, an array only with integer value
* @return {int}, the max value in this array
*/
Array.max = function(array){
    return Math.max.apply(Math, array);
};


/*
* Get the min value in an array
* @param {int}, an array only with integer value
* @return {int}, the min value in this array
*/
Array.min = function(array){
    return Math.min.apply(Math, array);
};