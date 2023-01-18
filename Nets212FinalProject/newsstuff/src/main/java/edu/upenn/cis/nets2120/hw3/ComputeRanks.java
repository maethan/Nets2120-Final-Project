package edu.upenn.cis.nets2120.hw3;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.Row;
import org.apache.spark.sql.SparkSession;
import org.apache.spark.sql.catalyst.expressions.GenericRowWithSchema;
import org.apache.spark.sql.types.StructType;

import com.opencsv.CSVReader;
import com.opencsv.exceptions.CsvValidationException;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;


import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.hw3.livy.MyPair;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;

public class ComputeRanks {
	/**
	 * The basic logger
	 */
	static Logger logger = LogManager.getLogger(ComputeRanks.class);

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;
	
	
	public ComputeRanks() {
		System.setProperty("file.encoding", "UTF-8");
	}

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 */
	public void initialize() throws IOException, InterruptedException {
		logger.info("Connecting to Spark...");

		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		
		logger.debug("Connected!");
	}
	
	/**
	 * Fetch the social network from the S3 path, and create a (followed, follower) edge graph
	 * 
	 * @param filePath
	 * @return JavaPairRDD: (followed: int, follower: int)
	 */
	JavaPairRDD<Integer,Integer> getSocialNetwork(String filePath) {
		JavaRDD<String[]> file = context.textFile(filePath, Config.PARTITIONS)
				.map(line -> line.toString().split("\\s+"));
		
		
		
		
		//use mapToPair to map the arrays containing nodeID and followerID to
		//a pairRDD that just has the nodeID and the follower ID
		JavaPairRDD<Integer,Integer> edgeRDD = file.mapToPair(
			
			line -> new Tuple2<>(Integer.parseInt(line[0]), Integer.parseInt(line[1]))
		);
		
		
		
		
		edgeRDD = edgeRDD.distinct();
		return edgeRDD;
		
		
		
	}


	JavaPairRDD<Integer,Integer> getNewsNet(String filePath) {
		JavaRDD<Row> items = spark.read().json(filePath).toJavaRDD();

		items.foreach(item -> {
			System.out.println(item);
		});		

		JavaRDD<String[]> file = context.textFile(filePath, Config.PARTITIONS)
				.map(line -> line.toString().split("\\s+"));
		
		
		
		
		//use mapToPair to map the arrays containing nodeID and followerID to
		//a pairRDD that just has the nodeID and the follower ID
		JavaPairRDD<Integer,Integer> edgeRDD = file.mapToPair(
			
			line -> new Tuple2<>(Integer.parseInt(line[0]), Integer.parseInt(line[1]))
		);

		
		
		edgeRDD = edgeRDD.distinct();
		return edgeRDD;
		
		
		
	}
	
	private JavaPairRDD<Integer, Integer> getSinks(JavaPairRDD<Integer,Integer> network) {
		
		//find the sinks by determining the distinct nodes which are edge destinations
		//and the distinct nodes that are edge origins
		//any node that is a destination but not an origin is a sink
		//use list subtraction to determine those nodes and return them
		JavaRDD<Integer> origins = network.keys().distinct();
		JavaRDD<Integer> destinations = network.values().distinct();
		
		JavaRDD<Integer> sinks = destinations.subtract(origins);
		
		JavaPairRDD<Integer, Integer> output = sinks.mapToPair(
				
				item -> new Tuple2<>(item, 0)
		);
		
		return output;
		
		
	}

	/**
	 * Main functionality in the program: read and process the social network
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public void run(String[] arguments) throws IOException, InterruptedException {
		
		//begun by initializing default values for d, delta, and maximum number of iterations
		double d = 0.15;  //decay factor
		int maxIters = 25;
		double delta = 30;
		boolean debugmode = false;
		
		//accept arguments
		if(arguments.length != 0) {
			
			for (int x = 0; x< arguments.length; x++) {
				if(x == 0) {
					delta = Float.parseFloat(arguments[x]);
				}
				if(x == 1) {
					maxIters = Integer.parseInt(arguments[x]);
				}
				if(x == 2) {
					debugmode = true;
				}
			}
			
		}
		
		
		
		
		logger.info("Running");

		// Load the social network
		// followed, follower

		getNewsNet(Config.NEWS_PATH);

		JavaPairRDD<Integer, Integer> network = getSocialNetwork(Config.SOCIAL_NET_PATH);
		
		JavaRDD<Integer> nodecount = network.values().distinct();
		
		System.out.println(nodecount.count() + " nodes " + network.count() + " edges");
		
		
		JavaPairRDD<Integer, Integer> edgeRDD = network;
		
		
    // ind the sinks
		
		JavaPairRDD<Integer, Integer> sinks = getSinks(network);
		
		
    // add back-edges
		
		JavaPairRDD<Integer, Integer> filteredlinks = network;
		
		
		//begun by reversing the network RDD so follower IDs come first
		JavaPairRDD<Integer, Integer> reversednet = network.mapToPair(item -> new Tuple2<>(item._2, item._1));
		
		
		//use map and join to find all edges that correspond to sinks as destinations and create revsred edges 
		filteredlinks = reversednet.join(sinks).mapToPair(item -> new Tuple2<>(item._1, item._2._1));
		
		System.out.println(filteredlinks.count() + " back-links");
		
		
		edgeRDD = edgeRDD.union(filteredlinks).distinct();
		
		
		//begin by initializing node transfer RDD to divide up weights among outgoing edges
		JavaPairRDD<Integer, Double> nodeTransferRDD = edgeRDD.mapToPair(item -> new Tuple2<Integer, Double>(item._1, 1.0)); 
		nodeTransferRDD = nodeTransferRDD.reduceByKey((a,b) -> a+b);
		nodeTransferRDD = nodeTransferRDD.mapToPair(item -> new Tuple2<Integer, Double>(item._1, 1.0/item._2));
		
		
		JavaPairRDD<Integer, Tuple2<Integer, Double>> edgeTransferRDD = edgeRDD.join(nodeTransferRDD);
		
		edgeTransferRDD.collect().stream().forEach(item -> {
		//System.out.println(item._1 + ": (" + item._2._1 + ", " + item._2._2 + ")");
		
		//all good here
		});
		
		
		
		//create edgeRDD by mapping nodes to their initial values
		JavaPairRDD<Integer, Double> pageRankRDD = edgeRDD.mapToPair(item -> new Tuple2<Integer, Double>(item._1, 1.0)).distinct();
		
		for(int i = 0; i < maxIters; i++) {
			
			//compute propogate RDD to determie which nodes the new weights are being assigned to
			JavaPairRDD<Integer, Double> propogateRDD = edgeTransferRDD
					.join(pageRankRDD)
					.mapToPair(item -> new Tuple2<Integer, Double>(item._2._1._1, item._2._2 * item._2._1._2));
			
			
			
			//use reducebykey to collate all weight transfers into final node values
			JavaPairRDD<Integer, Double> pageRankRDD2 = propogateRDD
					.reduceByKey((a,b) -> a+b)
					.mapToPair(item -> new Tuple2<Integer, Double>(item._1, d + (1-d)*item._2));
			
			
			if (debugmode == true) {
			
			//print debug info as necessary
			pageRankRDD2.collect().stream().forEach(item -> {
				
				System.out.println(item._1 + ": "+ item._2);
				
			});
			}
			
			//quit early if the maximum difference has been achieved 
			JavaRDD<Double> diffRDD = pageRankRDD.join(pageRankRDD2).map(
					
					item -> Math.abs((item._2._1)- (item._2._2))
				);
			
			
			double maxdiff = diffRDD.reduce((val1, val2) -> Math.max(val1, val2));
			
			if(maxdiff <= delta) {
				break;
			}
			
			pageRankRDD = pageRankRDD2;
			
			
		}
		
		//take the top 10 nodes with largest social rank values and return them
		JavaPairRDD<Double, Integer> reversedsorted = pageRankRDD.mapToPair(
				item -> new Tuple2<Double, Integer>(item._2, item._1)
				);
		
		List<Tuple2<Double, Integer>> output = reversedsorted.sortByKey(false).take(10);
		
		for(int x = 0; x< output.size(); x++) {
			Tuple2<Double, Integer>curr = output.get(x);
			System.out.println(curr._2 + " " +curr._1);
		}
		
		logger.info("*** Finished social network ranking! ***");
	}


	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");

		if (spark != null)
			spark.close();
	}
	
	

	public static void main(String[] args) {
		final ComputeRanks cr = new ComputeRanks();

		try {
			cr.initialize();
			cr.run(args);
			
			
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			cr.shutdown();
		}
	}

}
