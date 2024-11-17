import React from 'react';
import { useState } from 'react';
import OpenAI from "openai";

import {
  Action,
  Agent,
  PendingActionEvent,
  Prompt,
  TTS,
} from 'react-agents';

import { z } from 'zod';
import dedent from 'dedent'; 

const NewsAssistant = () => {

  const [shortNews, setShortNews] = useState('');
  // const [lastFetchedNews, setLastFetchedNews] = useState([]);

  let lastFetchedNews = [];
    
  const fetchNews = async (text: string, language: string) => {
    let newsUrl = 'https://api.worldnewsapi.com/search-news?text=${text}&language=${language}';
    // let newsUrl = `http://localhost:8000/search-news?text=${text}&language=${language}`;
    
    const api_key = "8e233fda6d8e48a6af211c9435838589";
  
    const headers = {
      'x-api-key': api_key
    }
  
    const response = await fetch(newsUrl, { headers });
    const data = await response.json();
    
    // Store the full articles data for later use
    let news = data.news.map((article: any, index: number) => ({
      id: index + 1,
      title: article.title,
      text: article.text || "No text available",
      summary: article.summary || "No summary available",
      url: article.url,
      publish_date: article.publish_date,
      author: article.author
    }));

    // console.log('news : ');
    // console.log(news);

    // setLastFetchedNews(news);
    lastFetchedNews = news;
    console.log('lastFetchedNews : ');
    console.log(lastFetchedNews);

    // Format the response for display
    const formattedNews = news
      .map((article, index) => (
        `Article ${index + 1}:\nTitle: ${article.title}\nSummary: ${article.summary}\n`
      ))
      .join('\n');

    setShortNews(formattedNews);
    return formattedNews;
  };

  const followUpNews = async (followUpQuestion: string) => {

    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
          { 
            role: "system", 
            content: "You are a helpful assistant. Your response should be in JSON format with only one key : ArticleId: integer" 
          },
          {
              role: "user",
              content: `Fetch the most releveant news article id based on the follow up question ${followUpQuestion}. And the data provided ; ${JSON.stringify(lastFetchedNews)}`,
          },
        ],
      });

    // Parse the JSON response from OpenAI
    const responseContent = JSON.parse(completion.choices[0].message.content);
    const articleId = responseContent.ArticleId;

    // Find the matching article
    const article = lastFetchedNews.find(article => article.id === articleId);
    console.log('matching article : ');
    console.log(article);
    
    if (!article) {
        return "Article not found";
    }

    return article.text;
  }

  return (
    <>
      <Action 
        name='searchNews'
        description="Retrieve a list of news articles from the World News API"
        schema={
          z.object({
            text: z.string(),
            language: z.string(),
          })
        }
        examples={[
          { 
            'text': 'American Elections 2024',
            'language': 'en',
          },
        ]}
        handler={
          async (e: PendingActionEvent) => {
            
            const { text, language } = e.data.message.args as { text: string, language: string };
            const news =await fetchNews(text, language);

            const monologueString = dedent`\
              Your character fetched details about news articles relating to a specific topic and discovered the following:
            ` + '\n\n' + news;

            await e.data.agent.monologue(monologueString);  
            await e.commit();
          }
        }
      />

      <Action
        name='followUpNews'
        description='Fetch the single news article to answer a follow up question.'
        // You have to map the followUp question to an articleId by guessing user has asked a follow up question from which article.'
        schema={
          z.object({
            followUpQuestion: z.string(),
          })
        }
        examples={[
          { 
            followUpQuestion: 'tell me more about the first article',
          },
          {
            followUpQuestion: 'what happened in the SCO Summit?',
          }
        ]}
        handler={
          async (e: PendingActionEvent) => {

            const { followUpQuestion } = e.data.message.args as { 
              followUpQuestion: string,
            };

            const news = await followUpNews(
              followUpQuestion, 
            );
            
            const monologueString = dedent`\
              Your character fetched details about a specific news article depending on the follow up question and discovered the following:
            ` + '\n\n' + news;

            await e.data.agent.monologue(monologueString);  
            await e.commit();
          }
        }
      />
    </>
  );
};

export default function MyAgent() {
  return (
    <Agent /* */ >

      {/* <TTS voiceEndpoint="elevenlabs:uni:PSAakCTPE63lB4tP9iNQ" /> */}

      <Prompt>
        You are a polite, humorous news assistant with a knack for storytelling and a deep understanding of historical context. You are tasked with fetching and explaining news articles from the World News API. Your primary goal is to engage users with accurate and context-rich information while maintaining a friendly and approachable tone.

        Instructions:
        - If the user asks for latest or trending news, use the latestNews action to fetch the news and provide a brief overview. Highlight key stories and trends.
        - If the user asks for a specific news topic, use the fetchNews action to fetch the news. Briefly explain the news with relevant details and context.
        - If the user asks for summaries or analyses, use the summarizeNews action to generate concise, meaningful insights.
        - If the user asks for details about a particular news article, use the fetchNews action to fetch the details and present them clearly.
        - If the user asks a follow-up question, use the followUpNews action to respond thoughtfully using historical or contextual information that might enhance their understanding or address something they might have missed.
        - If the user’s request is unrelated to news, politely guide them back to news-related topics, offering to share the latest stories, summaries, or analyses.

        Key Guidelines:
        - Engage with Humor and Context: Use relatable analogies and historical insights to make the news more digestible and engaging, while remaining professional.
        - Adapt to Follow-Up Questions: Seamlessly incorporate historical or contextual references to clarify or expand upon prior news topics.
        - Encourage Interaction: Invite the user to ask more questions or specify what they'd like to explore further.
      </Prompt>

      <NewsAssistant />

    </Agent>
  );
}

