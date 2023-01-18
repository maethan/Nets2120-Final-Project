package edu.upenn.cis.nets2120.hw3.livy;


import java.io.IOException;
import java.util.ArrayList;
import java.util.List;


import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;


import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;


public class SocialRankJob implements Job<List<MyPair<Integer,Double>>> {
    /**
     *
     */
    private static final long serialVersionUID = 1L;


    /**
     * Connection to Apache Spark
     */
    SparkSession spark;
    
    JavaSparkContext context;


    private boolean useBacklinks;


    private String source;
    


    /**
     * Initialize the database connection and open the file
     *
     * @throws IOException
     * @throws InterruptedException
     * @throws DynamoDbException
     */
    public void initialize() throws IOException, InterruptedException {
            System.out.println("Connecting to Spark...");
            spark = SparkConnector.getSparkConnection();
            context = SparkConnector.getSparkContext();
            
            System.out.println("Connected!");
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
		//a pairRDD that just has the nodeID and follower ID
		JavaPairRDD<Integer,Integer> edgeRDD = file.mapToPair(
			
			line -> new Tuple2<>(Integer.parseInt(line[0]), Integer.parseInt(line[1]))
		);
		
		
		
		
		edgeRDD = edgeRDD.distinct();
		return edgeRDD;
		
    }
    
    private JavaRDD<Integer> getSinks(JavaPairRDD<Integer,Integer> network) {
    	
    	//find the sinks by determining the distinct nodes which are edge destinations
    			//and the distinct nodes that are edge origins
    			//any node that is a destination but not an origin is a sink
    			//use list subtraction to determine those nodes and return them
    	
    	JavaRDD<Integer> origins = network.keys().distinct();
		JavaRDD<Integer> destinations = network.values().distinct();
		
		JavaRDD<Integer> sinks = destinations.subtract(origins);
		
		return sinks;
    }


    /**
     * Main functionality in the program: read and process the social network
     *
     * @throws IOException File read, network, and other errors
     * @throws DynamoDbException DynamoDB is unhappy with something
     * @throws InterruptedException User presses Ctrl-C
     */
    public List<MyPair<Integer,Double>> run() throws IOException, InterruptedException {
            System.out.println("Running");
    		//begun by initializing default values for d, delta, and maximum number of iterations

            double d = 0.15;  
    		int maxIters = 25;
    		double delta = 30;
    		
           
            JavaPairRDD<Integer, Integer> network = getSocialNetwork(source);


            //next, load our sinks and our edgeRDD
            JavaRDD<Integer> output = getSinks(network);
            
            JavaPairRDD<Integer, Integer> sinks = output.mapToPair(
    				
    				item -> new Tuple2<>(item, 0)
    		);

        	JavaRDD<Integer> nodecount = network.values().distinct();
    		
    		
    		
    		JavaPairRDD<Integer, Integer> edgeRDD = network;
    		
    		//if the condition is set to true we add back edges
    		//begin by reversing the network RDD so follower IDs come first
    		//use map and join to find all edges that correspond to sinks as destinations and create revsred edges 

    		if (this.useBacklinks == true) {
    			JavaPairRDD<Integer, Integer> filteredlinks = network;
        		
        		JavaPairRDD<Integer, Integer> reversednet = network.mapToPair(item -> new Tuple2<>(item._2, item._1));
        		
        		
        		
        		
        		filteredlinks = reversednet.join(sinks).mapToPair(item -> new Tuple2<>(item._1, item._2._1));
        		
        		
        		edgeRDD = edgeRDD.union(filteredlinks).distinct();
    		}
    		
    		
    		
    		
    		//begin by initializing node transfer RDD to divide up weights among outgoing edges

    		JavaPairRDD<Integer, Double> nodeTransferRDD = edgeRDD.mapToPair(item -> new Tuple2<Integer, Double>(item._1, 1.0)); 
    		nodeTransferRDD = nodeTransferRDD.reduceByKey((a,b) -> a+b);
    		nodeTransferRDD = nodeTransferRDD.mapToPair(item -> new Tuple2<Integer, Double>(item._1, 1.0/item._2));
    		
    		
    		//create edgeRDD by mapping nodes to their initial values

    		JavaPairRDD<Integer, Tuple2<Integer, Double>> edgeTransferRDD = edgeRDD.join(nodeTransferRDD);
    		
    		
    		
    		
    		
			//compute propogate RDD to determie which nodes the new weights are being assigned to

    		JavaPairRDD<Integer, Double> pageRankRDD = edgeRDD.mapToPair(item -> new Tuple2<Integer, Double>(item._1, 1.0)).distinct();
    		
    		for(int i = 0; i < maxIters; i++) {
    			JavaPairRDD<Integer, Double> propogateRDD = edgeTransferRDD
    					.join(pageRankRDD)
    					.mapToPair(item -> new Tuple2<Integer, Double>(item._2._1._1, item._2._2 * item._2._1._2));
    			
    			
    			//use reducebykey to collate all weight transfers into final node values

    			
    			JavaPairRDD<Integer, Double> pageRankRDD2 = propogateRDD
    					.reduceByKey((a,b) -> a+b)
    					.mapToPair(item -> new Tuple2<Integer, Double>(item._1, d + (1-d)*item._2));
    			
    			
    			
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
    		
    		List<MyPair<Integer, Double>> newoutput = reversedsorted.sortByKey(false)
    				.map(item -> new MyPair<Integer, Double>(item._2, item._1))
    				.take(10);
    		
    		ArrayList<MyPair<Integer, Double>> finaloutput = new ArrayList<>();
    		for(int x = 0; x< 10; x++) {
    			finaloutput.add(newoutput.get(x));
    		}
    		
    		System.out.println(finaloutput);
    		
                    
            System.out.println("*** Finished social network ranking! ***");


        return finaloutput;
    }


   
    
    public SocialRankJob(boolean useBacklinks, String source) {
            System.setProperty("file.encoding", "UTF-8");
            this.useBacklinks = useBacklinks;
            this.source = source;
    }


    @Override
    public List<MyPair<Integer,Double>> call(JobContext arg0) throws Exception {
            initialize();
            return run();
    }


}