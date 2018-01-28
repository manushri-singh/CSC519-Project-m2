import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import javax.xml.parsers.ParserConfigurationException;
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;

import org.xml.sax.Attributes;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

public class UselessTests 
{
	private static File junitFile;
	private static boolean className = false;
	private static boolean testName = false;
	private static boolean failedSince = false;
	private static boolean failed = false;
	private static String clazz = null;
	private static String testCase = null;
	private static Map<String, String> passedCases = new HashMap<>();
	private static Set<String> listOfTestCases = new HashSet<>();
	private static final String FILEPATH = "/var/lib/jenkins/jobs/iTrust-fuzzer-job/builds";

	public static boolean isInteger(String s) {
		try { 
			Integer.parseInt(s); 
		} catch(NumberFormatException e) { 
			return false; 
		} catch(NullPointerException e) {
			return false;
		}
		
		return true;
	}

	private static int getLatestBuildNumber()
	{
		File folder = new File(FILEPATH);
		String[] names = folder.list();
		int maxInteger = 1;
	
		for(String name : names)
		{
			if(isInteger(name))
			{
				int intVal = Integer.parseInt(name);
				if(maxInteger < intVal)
					maxInteger = intVal;
			}
		}

		return maxInteger;
	}
	
	public static void main(String[] args) throws ParserConfigurationException, SAXException, IOException 
	{
		SAXParserFactory factory = SAXParserFactory.newInstance();
		SAXParser parser = factory.newSAXParser();

		int buildNumber = getLatestBuildNumber();
		int originalBuildNumber = buildNumber;
		int maxIterations = 100;

		while(buildNumber > 0 && maxIterations-- > 0)
		{
			junitFile = new File(FILEPATH + "/" + buildNumber + "/junitResult.xml"); // This is the path of the junit result file

			if(!junitFile.exists())
			{
				System.out.println("Cannot find junitResult.xml at specified path: " + junitFile.getAbsolutePath() + ". Ignoring results from this build");
				buildNumber--;
				continue;
			}
					
			parser.parse(junitFile, new SaxHandler());
			buildNumber--;
		}
		
		final AtomicInteger count = new AtomicInteger();
		try(PrintWriter writer = new PrintWriter(new FileWriter(FILEPATH + "/" + originalBuildNumber + "/uselessTests.txt")))
		{
			writer.println("Total number of useless tests: " + passedCases.size());
			writer.println("");
			writer.println("-------------------------------------------");
			writer.println("Test name -> Class name");
			writer.println("-------------------------------------------");
			passedCases.forEach((testName, clazz) -> {
				writer.printf("%d) %s -> %s\n", count.incrementAndGet(), testName, clazz);
			});
		}
	}
	
	private static class SaxHandler extends DefaultHandler
	{

		@Override
		public void startElement(String uri, String localName, String qName, Attributes attributes)
				throws SAXException 
		{
			switch(qName)
			{
			case "className":
				className = true;
				break;
			case "testName":
				testName = true;
				break;
			case "failedSince":
				failedSince = true;
				break;
			case "case":
				className = false;
				testName = false;
				failedSince = false;
				failed = false;
				break;
			}
			
			super.startElement(uri, localName, qName, attributes);
		}

		@Override
		public void characters(char[] ch, int start, int length) throws SAXException {
			
			if(className)
			{
				clazz = String.copyValueOf(ch, start, length);
			}
			else if(testName)
			{
				testCase = String.copyValueOf(ch, start, length);
			}
			else if(failedSince)
			{
				int failedSinceVal = Integer.parseInt(String.copyValueOf(ch, start, length));
				if(failedSinceVal > 0)
					failed = true;
				else
					failed = false;
			}
			
			super.characters(ch, start, length);
		}
		
		@Override
		public void endElement(String uri, String localName, String qName) throws SAXException {
			
			switch(qName)
			{
			case "className":
				className = false;
				break;
			case "testName":
				testName = false;
				break;
			case "failedSince":
				failedSince = false;
				break;
			case "case":
				finalizeCase();
				break;
			}
			
			super.endElement(uri, localName, qName);
		}
		
		public void finalizeCase() 
		{ 
			if(!clazz.contains("AddApptRequestAction"))
			{
				if(failed)
				{
					passedCases.remove(testCase);
				}
				else if(!listOfTestCases.contains(testCase))
				{
					passedCases.put(testCase, clazz);
				}
				listOfTestCases.add(testCase);
			}
		}
	}

}
