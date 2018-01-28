var esprima = require("esprima");
var options = {tokens:true, tolerant: true, loc: true, range: true };
var fs = require("fs");
var path = require('path');
var glob = require('glob');
var recursiveReadSync = require('recursive-readdir-sync')


var flag= false;

function main()
{
	var args = process.argv.slice(2);
	var filepath= [];

	if( args.length == 0 )
	{
		filepath = ["analysis.js"];
	} else {
		if (process.argv.length < 3) {
		    console.log('Usage: analysis.js checkbox-io_directory');
		    process.exit(1);
		}
		var dirname = process.argv[2] + '/server-side/';
		var files = recursiveReadSync(dirname);

		for( var file in files)
		{
                      if(files[file].endsWith(".js")) {
//                            console.log(files[file]);
                              filepath.push(files[file])	
			}
		}

	}

	for( var file in filepath) {
//		console.log( 'Reading ' + filepath[file] );
		complexity(filepath[file]);
 	}

	// Report
	for( var node in builders )
	{
		var builder = builders[node];
		if(builder.BigO > 3 || builder.SyncCalls > 1 || builder.NumLines > 120 || builder.LongestMessageChain > 3) 
		{
			console.log('******FAIL******');
			builder.report();
			console.log('\n\n');
			flag=true;
		}
                /*else
		{
			console.log('******PASS******');
			builder.report();
		}*/
	}

	if(flag==true) process.exit(1);
}



var builders = {};

// Represent a reusable "class" following the Builder pattern.
function FunctionBuilder()
{
	this.StartLine = 0;
	this.FileName = "";
	this.FunctionName = "";
	// The number of parameters for functions
	this.ParameterCount  = 0,
	// Number of if statements/loops + 1
	this.SimpleCyclomaticComplexity = 0;
	// The max depth of scopes (nested ifs, loops, etc)
	this.MaxNestingDepth    = 0;
	// The max number of conditions if one decision statement.
	this.MaxConditions      = 0;
	// The Big O complexity of this function.
	this.BigO      = 0;
	// The Number of Lines in this function.
	this.NumLines    = 0;
	// The Number of *Sync Calls in this function.
	this.SyncCalls    = 0;
	// The Longest Message Chain in this function.
	this.LongestMessageChain = 0;



	this.report = function()
	{
		console.log(
		   (
		   	"{0}: \n"
		   ).format(this.FileName)
		);
		console.log(
		   (
		   	"{0}(): {1}\n" +
		   	"============\n" +
			   "SimpleCyclomaticComplexity: {2}\t" +
				"MaxNestingDepth: {3}\t" +
				"MaxConditions: {4}\t" +
				"Parameters: {5}\n\n" +
				"Big O Complexity: {6}\t" + 
				"Number of Lines: {7}\t" +  
				"Number of SyncCalls: {8}\t" +
				"Longest Message Chain: {9}\n\n" 
			)
			.format(this.FunctionName, this.StartLine,
				     this.SimpleCyclomaticComplexity, this.MaxNestingDepth,
			        this.MaxConditions, this.ParameterCount, this.BigO, 
					this.NumLines, this.SyncCalls, this.LongestMessageChain )
		);
	}
};

// A builder for storing file level information.
function FileBuilder()
{
	this.FileName = "";
	// Number of strings in a file.
	this.Strings = 0;
	// Number of imports in a file.
	this.ImportCount = 0;

	this.report = function()
	{
		console.log (
			( "{0}\n" +
			  "~~~~~~~~~~~~\n"+
			  "ImportCount {1}\t" +
			  "Strings {2}\n"
			).format( this.FileName, this.ImportCount, this.Strings ));
	}
}

// A function following the Visitor pattern.
// Annotates nodes with parent objects.
function traverseWithParents(object, visitor)
{
    var key, child;

    visitor.call(null, object);

    for (key in object) {
        if (object.hasOwnProperty(key)) {
            child = object[key];
            if (typeof child === 'object' && child !== null && key != 'parent') 
            {
            	child.parent = object;
					traverseWithParents(child, visitor);
            }
        }
    }
}


// Used to traverse the inner nodes to check message passing
function traverseWithMessagePassingParent(object, paraChainCount)
{
    var key, child, chainCount;

    if(object.type === 'MemberExpression' && object.computed==false)
	{
		if(object.object.type == 'Identifier')
		{
			paraChainCount++
		}
		if(object.property.type == 'Identifier')
		{
			paraChainCount++
		}
	}

	var originalChainCount = paraChainCount
	var resultChainCount = originalChainCount
    for (key in object) {
        if (object.hasOwnProperty(key)) {
			child = object[key];
            if (typeof child === 'object' && child !== null && key != 'parent') 
            {
				if(child.type === 'CallExpression')
				{	
					child.arguments.parent = child;
					var callExpressionCount = traverseWithMessagePassingParent(child.arguments, 0);
					
					child.callee.parent = child;
					chainCount = traverseWithMessagePassingParent(child.callee, originalChainCount);
					
					if(chainCount < callExpressionCount)
						chainCount = callExpressionCount
				}
				else if(child.type === 'MemberExpression')
				{
					child.parent = object;
					
					chainCount = traverseWithMessagePassingParent(child, originalChainCount);
				}
				else
				{
					child.parent = object;
					var newChainCount = traverseWithMessagePassingParent(child, 0);
					chainCount = originalChainCount < newChainCount ? newChainCount : originalChainCount
				}

				resultChainCount = resultChainCount < chainCount ? chainCount : resultChainCount
            }
        }
	}
	return resultChainCount
}

function functionLongestMessageChain(functionHead)
{
    var currentMessageChain = 0;
	var longestMessageChain = 0;
	
	traverseWithParents(functionHead, function(functionChild)
	{
		if( functionChild.type == 'MemberExpression')
		{
			currentMessageChain = traverseWithMessagePassingParent(functionChild, 0)
		}

		if(longestMessageChain < currentMessageChain)
			longestMessageChain = currentMessageChain;
	})

	return longestMessageChain;
}



function complexity(filePath)
{
	var buf = fs.readFileSync(filePath, "utf8");
	var ast = esprima.parse(buf, options);
	
	var i = 0;

	// A file-level builder:
	var fileBuilder = new FileBuilder();
	// A function-level builder
	var builder = new FunctionBuilder();
	fileBuilder.FileName = filePath;
	fileBuilder.ImportCount = 0;
	builders[filePath] = fileBuilder;

	// Tranverse program with a function visitor.
	traverseWithParents(ast, function (node) 
	{
		if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' ) 
		{
			builder = new FunctionBuilder();
			builder.FileName = filePath;
			builder.FunctionName = functionName(node);
			builder.StartLine    = node.loc.start.line;
			builder.ParameterCount    = functionParamCount(node);
			functionBigO(node,0, builder);
			builder.NumLines    = functionNumLines(node);
			builder.SyncCalls    = functionSyncCalls(node);
			builder.LongestMessageChain = functionLongestMessageChain(node);
		}
	builders[builder.FunctionName] = builder;
 
   // PackageComplexity: The number of imports used by code.
    if(node.type=='CallExpression') {
	if(node.callee && node.callee.name=='require')
        	fileBuilder.ImportCount++;
    }


    traverseWithParents(node, function(child)
	 {
        	if(child.type==='IfStatement') {
//            	builder.SimpleCyclomaticComplexity++;
    		}
 	});
      });

}

function functionSyncCalls(node)
{
        var key, child;
        var count = 0;

    if(node.type=='CallExpression') {
        if(node.callee && node.callee.name=='readFileSync')
                count++;
    }
	traverseWithParents(node, function(child)
	    {
 	      	if(child.callee && child.callee.property && child.callee.property.name.endsWith('Sync'))
	              count++;
	        });
	return count;
}

// Helper function for counting children of node.
function childrenLength(node)
{
	var key, child;
	var count = 0;
	for (key in node) 
	{
		if (node.hasOwnProperty(key)) 
		{
			child = node[key];
			if (typeof child === 'object' && child !== null && key != 'parent') 
			{
				count++;
			}
		}
	}	
	return count;
}


// Helper function for checking if a node is a "decision type node"
function isDecision(node)
{
	if( node.type == 'IfStatement' || node.type == 'ForStatement' || node.type == 'WhileStatement' ||
		 node.type == 'ForInStatement' || node.type == 'DoWhileStatement')
	{
		return true;
	}
	return false;
}

// Helper function for printing out function name.
function functionName( node )
{
	if( node.id )
	{
		return node.id.name;
	}
	return "anon function @" + node.loc.start.line;
}

//ParameterCount: The number of parameters for functions
// Helper function for printing out function parameter count.
function functionParamCount(node)
{
	var pcount = 0;
	if( node.id )
	{
		return node.params.length;
	}
	return pcount;
}

function functionNumLines(node)
{
	var numLines=0;
        if( node.id )
        {
                numLines = node.loc.end.line - node.loc.start.line +1;
        }
        return numLines;
}


function functionBigO(node,children, build)
{
        var key, child;
        var count = 0;
        for (key in node)
        {
                if (node.hasOwnProperty(key))
                {
                        child = node[key];
                        if (typeof child === 'object' && child !== null && key != 'parent')
                        {
                                count++;
                                if(child.type == 'ForStatement' || child.type == 'WhileStatement' ||
                 child.type == 'ForInStatement' || child.type == 'DoWhileStatement'){
                                        functionBigO(child, children+1, build);
                                } else{
                                        functionBigO(child, children, build);
                                }

                        }
                }
        }
//        return count;
        if(count == 0 && build.BigO < children){
                build.BigO = children;
        }

}


// Helper function for allowing parameterized formatting of strings.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

main();

function Crazy (argument) 
{

	var date_bits = element.value.match(/^(\d{4})\-(\d{1,2})\-(\d{1,2})$/);
	var new_date = null;
	if(date_bits && date_bits.length == 4 && parseInt(date_bits[2]) > 0 && parseInt(date_bits[3]) > 0)
    new_date = new Date(parseInt(date_bits[1]), parseInt(date_bits[2]) - 1, parseInt(date_bits[3]));

    var secs = bytes / 3500;

      if ( secs < 59 )
      {
          return secs.toString().split(".")[0] + " seconds";
      }
      else if ( secs > 59 && secs < 3600 )
      {
          var mints = secs / 60;
          var remainder = parseInt(secs.toString().split(".")[0]) -
(parseInt(mints.toString().split(".")[0]) * 60);
          var szmin;
          if ( mints > 1 )
          {
              szmin = "minutes";
          }
          else
          {
              szmin = "minute";
          }
          return mints.toString().split(".")[0] + " " + szmin + " " +
remainder.toString() + " seconds";
      }
      else
      {
          var mints = secs / 60;
          var hours = mints / 60;
          var remainders = parseInt(secs.toString().split(".")[0]) -
(parseInt(mints.toString().split(".")[0]) * 60);
          var remainderm = parseInt(mints.toString().split(".")[0]) -
(parseInt(hours.toString().split(".")[0]) * 60);
          var szmin;
          if ( remainderm > 1 )
          {
              szmin = "minutes";
          }
          else
          {
              szmin = "minute";
          }
          var szhr;
          if ( remainderm > 1 )
          {
              szhr = "hours";
          }
          else
          {
              szhr = "hour";
              for ( i = 0 ; i < cfield.value.length ; i++)
				  {
				    var n = cfield.value.substr(i,1);
				    if ( n != 'a' && n != 'b' && n != 'c' && n != 'd'
				      && n != 'e' && n != 'f' && n != 'g' && n != 'h'
				      && n != 'i' && n != 'j' && n != 'k' && n != 'l'
				      && n != 'm' && n != 'n' && n != 'o' && n != 'p'
				      && n != 'q' && n != 'r' && n != 's' && n != 't'
				      && n != 'u' && n != 'v' && n != 'w' && n != 'x'
				      && n != 'y' && n != 'z'
				      && n != 'A' && n != 'B' && n != 'C' && n != 'D'
				      && n != 'E' && n != 'F' && n != 'G' && n != 'H'
				      && n != 'I' && n != 'J' && n != 'K' && n != 'L'
				      && n != 'M' && n != 'N' &&  n != 'O' && n != 'P'
				      && n != 'Q' && n != 'R' && n != 'S' && n != 'T'
				      && n != 'U' && n != 'V' && n != 'W' && n != 'X'
				      && n != 'Y' && n != 'Z'
				      && n != '0' && n != '1' && n != '2' && n != '3'
				      && n != '4' && n != '5' && n != '6' && n != '7'
				      && n != '8' && n != '9'
				      && n != '_' && n != '@' && n != '-' && n != '.' )
				    {
				      window.alert("Only Alphanumeric are allowed.\nPlease re-enter the value.");
				      cfield.value = '';
				      cfield.focus();
				    }
				    cfield.value =  cfield.value.toUpperCase();
				  }
				  return;
          }
          return hours.toString().split(".")[0] + " " + szhr + " " +
mints.toString().split(".")[0] + " " + szmin;
      }
  }
 

/* function temp(argument)
{
        fs.readFileSync('jade/singlechoice.jade', 'utf8');
        var singlechoice = jade.compile(fs.readFileSync('jade/singlechoice.jade', 'utf8'),options);
        var multichoice = jade.compile(fs.readFileSync('jade/multichoice.jade', 'utf8'),options);
        var singlechoicetable = jade.compile(fs.readFileSync('jade/singlechoicetable.jade', 'utf8'),options);
        var multichoicetable = jade.compile(fs.readFileSync('jade/multichoicetable.jade', 'utf8'),options);
        var text = jade.compile(fs.readFileSync('jade/text.jade', 'utf8'),options);
        var textarea = jade.compile(fs.readFileSync('jade/textarea.jade', 'utf8'),options);
        var code = jade.compile(fs.readFileSync('jade/code.jade', 'utf8'),options);
        
        var fileupload = jade.compile(fs.readFileSync('jade/upload.jade', 'utf8'),options);


        var fileupload1 = jade.compile(fs.existsSync('jade/upload.jade'),options);


	for(i=0;i<10;i++) {
		for(j=0;j<10;j++) {
			for(k=0;k10;k++) {
			}
			for(k=0;k10;k++) {
			}
		}
	}

}


function temp2(argument) {}
*/

exports.main = main;

