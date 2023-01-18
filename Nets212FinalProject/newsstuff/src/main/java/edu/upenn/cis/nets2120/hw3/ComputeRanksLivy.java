package edu.upenn.cis.nets2120.hw3.livy;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;

import edu.upenn.cis.nets2120.config.Config;

public class ComputeRanksLivy {
	public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
		
		LivyClient client = new LivyClientBuilder()
				  .setURI(new URI("http://ec2-34-233-124-109.compute-1.amazonaws.com:8998"))
				  .build();

		try {
			String jar = "target/nets2120-hw3-0.0.1-SNAPSHOT.jar";
			
		  System.out.printf("Uploading %s to the Spark context...\n", jar);
		  client.uploadJar(new File(jar)).get();
		  
		  
		  String sourceFile = Config.BIGGER_SOCIAL_NET_PATH;

		  System.out.printf("Running SocialRankJob with %s as its input...\n", sourceFile);
		  List<MyPair<Integer,Double>> temp = client.submit(new SocialRankJob(true, sourceFile)).get();
		  System.out.println("With backlinks: " + temp);

		  
		  
// CODE FOR LOADING RESULTS1.TXT IS BELOW
		  
// 		  List<MyPair<Integer,Double>> temp2 = client.submit(new SocialRankJob(false, sourceFile)).get();
// 		  System.out.println("Without backlinks: " + temp2);
//		  
//		  
//		 
// 		
// 		  
// 		 ArrayList<Integer> result = new ArrayList<>() ;
// 		 ArrayList<Integer> result2 =  new ArrayList<>();
// 		 
// 		 for (int x = 0; x< 10; x++) {
// 			  int back = temp.get(x).left;
// 			  int noback = temp2.get(x).left;
// 			  result.add(back);
// 			  result2.add(noback);
// 		  }
// 		 
// 		 //begin by creating separate lists for just the node IDs
// 				  
// 		  ArrayList<Integer> inbacklinks = new ArrayList<>() ;
// 		  ArrayList<Integer> notinlinks =  new ArrayList<>();
// 		  HashSet<Integer> inbothlinks =  new HashSet<>();
// 		  
// 		  
		  //create three lists, for nodes solely in the output with no back links
		  //nodes in the output with backlinks, and nodes in common
		  
// 		  for (int x = 0; x < 10; x++) {
// 			  int back = result.get(x);
// 			  int noback = result2.get(x);
// 			  
// 			  boolean inresult2 = false;
// 			  boolean inresult = false;
// 			  
// 			  for (int y = 0; y < 10; y++) {
// 				  int curr = result2.get(y);
// 				  if(curr == back) {
// 					  inresult2 = true;
// 				  }
// 			  }
// 			  
// 			  for(int z = 0; z < 10; z++) {
// 				  int curr = result.get(z);
// 				  if(curr == noback) {
// 					  inresult = true;
// 				  }
// 			  }
// 			  
// 			  if(inresult2 == true) {
// 				  inbothlinks.add(back);
// 			  }
// 			  if(inresult2 == false) {
// 				  inbacklinks.add(back);
// 			  }
// 			  if(inresult == true) {
// 				  inbothlinks.add(noback);
// 			  }
// 			  if(inresult == false) {
// 				  notinlinks.add(noback);
// 				  
// 			  }
// 			  
// 		  }
//
// 		  //initialize our filewriter to create and write the tostrings for our three outputs
		  
// 		  try {
// 		      File newfile = new File("results1.txt");
// 		      if (newfile.createNewFile()) {
// 		        System.out.println("file successfully created");
// 		      }
// 		    } catch (IOException e) {
// 		      e.printStackTrace();
// 		    }
// 		  
// 		  try {
// 		      FileWriter filewrite = new FileWriter("results1.txt");
// 		      filewrite.write("nodes in both links: " + inbothlinks.toString());
// 		      filewrite.write("\n");
// 		      filewrite.write("nodes solely in comp w/ back links: "+ inbacklinks.toString());
// 		      filewrite.write("\n");
// 		      filewrite.write("nodes solely in comp w/ no back links: " + notinlinks.toString());
// 		      filewrite.close();
// 		    } catch (IOException e) {
// 		      e.printStackTrace();
// 		    }
//		  
//		  
		  
		  
		  //separate code for writing to results2.txt
		  try {
		      File newfile = new File("results2.txt");
		      if (newfile.createNewFile()) {
		        System.out.println("file successfully created");
		      }
		    } catch (IOException e) {
		      e.printStackTrace();
		    }
		  
		  try {
		      FileWriter filewrite = new FileWriter("results2.txt");
		      filewrite.write("top 10 nodes: " + temp.toString());
		      filewrite.close();
		    } catch (IOException e) {
		      e.printStackTrace();
		    }
		  
		  
		  
		  
		  
		} finally {
		  client.stop(true);
		}
	}

}
