make sure to document the changes first and make a checklist 
pending for today:

Cash advance for for crews and can see their app and Admins can see approval SA and ASA (copy the form in the fillout) also take note it deducts from the cash left for that day of request and will reflect on the finance. 


Ensure fully customizability and editable categories for expenses 
Fully editable also for the shares
fix the cermic since the system is confunsed just make sure it's detaling and clear all ceramic in the code since it supposed to be a detailing service.
Remove the list in the detailing board
Edit the formatting for POS sizes of the car
For expense make sure it can deduct or either cash or gcash when deducting
For expense also it will include the monthly salaries for employees up until ASA can be choosen cash or gcash that is computed monthly or just make a payroll page that will go to the finance
Remove the KPI page and include them in the floorboard
Make sure inventory is connected to the POS also and also finance and ensure comutations is correct and it will deduct and also per branch the inventory and FULLY CRUD especially on the services and packages and detailing and make sure data workflow and make sense 
Remove branch stock tab since it's redudnant and ensure that branch stock is integrated in the tables already and fully modifyable  and customizable and proper money and data workflow for the stocks
Put a lock on the inventory cannot CRUD inventory andcanunlock and lock and also SA can see that audit and notifies SA.
Remove reviews since the customer reviews we redirect them to google reviews and and if thumbs down redirect to complaint form and make sure in the planner rsults of all the forms and also in the planner board can link to a specific form so they can visually see the results answered by the customers and ensure all forms are visible in the planner and consistency in the design. Also if the birthday of the employees inlcuding admins if their bday it will shows as announcemnet
Crew can also see the total crew salary for the day and also time in time out their weekly attendance also board planner but read only and ensure all employees can edit their profile and also put their personal details and birthday.
Ensure that superadmin/asa can make categories for planner control the category on who can see the specific category and fully customizaible create read update and delete.
Also since customers inpts their personal details including their bday so if it's their  bday ensure that TL can see if that customer is queued and also the note also is visible if it;s a repeat customer.
Ensure crew has cash advance form and make a cash advance for and om their app and cash advance form is also editable in the planner form maker
Ensure all forms are editable and connected to the system data wise in the planner form feedback form, cash advance form, equipment repair form, booking form.
Ensure that planner and all it's functions make sense and functional and fully customizable. 
Ensure when it's a repeat customer or a customer that has account already would show details on the queue when autofilled and includes the notes history and who wrote the notes and date.
Make a notification if it's their birthday for the customer and when they click the notification they will be redirected vouchers page with the code of birthday wash code and also trhey have 7 days to claim and used once.
Also ensure for the vocuher codes only TL can type the code in the queue for services/packages or detailing related. ensure when claiming rules that customer can see the rules of the vouchers so they will know also the process that they should show it to the TL and ensure for the customer can see voucher history.
Ensure SA can edit fully customizable for the vouchers and usage and also for example first 10 customers or duration or promotion purposes
Make a users page for the Admins can see like points, history, vouchers used, notes, transactions and personal details basically everything about the customer. 
For customer login and sign up phone number is a must.





1. fix form for internal form to book detailing jobs like ceramic coating, tint and PPF. Add booking source to saw your Facebook ads, Talked to an employee (with another question on the name of employee), Referred by a customer (another question of referral code from existing customer) and Inquiry on Facebook page.
2. Change formatting of tint display, fix the logic on tint finder
3. Inventory  should be able to add inventory per branch, as well transfer inventory from an existing branch
4. SMS notifications. Create acknowledgement notifications for detailing booking (Separate notification templates for when it's customer who booked from the app or website and another set when it's an employee who booked the service in the app for the customer in behalf), notifications per status of car wash (see telegram message), notifications per status of detailing job.
Note: Always exempt any notification when the job failed QA.
5. Add birthday greeting on app and SMS notification. Birthday can only modified once. They get free premium wash on the date of their bday!.
6. Referral program for customer, customer share their booking code and their friends and family get 5% discount on detailing service. Plus after the job is completed, they get points that they can use to redeem prices or feature unlock in the future
7.Every completed transaction in car wash, customer should get a separate notification after 15 minutes with a Rate your recent visit with Hakum message?  Then thumbs up and thumbs down. If customer choose thumbs up it goes directly to google review of the specific branch he last visit. If it's thumbs down, go to the internal form for complaint so management can review the feedback and it doesn’t go to google review
8.Do the same for Hakum Auto Detailing

Pending 
- Define tomorrow the points, free and other settings related to customer points and visit
- Add tittle on the tint finder app
- Define RBAC model 
- Finalize voucher code

[10/18/2026 10:02 PM] Sir michi: Crew app
Reflect total input salary in daily sheet so they know what the salary for the day they will share for the rest of the crew.
Time in and time out
Currently assigned car and service
Total number of failed QA

Planner

When customer choose thumbs down it goes to feedback form and when submitted - go to feedback board for review.

Cash advance salary - fill up form - goes to board, Lucy has to approve - admin will get code from planner - put code when creating expense - provide salary to employee

Equipment form - employee fill up form - goes to planner board for review

Birthday board for employee - all employee will have to put birthday in their profile. List down all employee with birthday for the month

Board List so far
Feedback form
Cash Advance Form
Equipment Repair Form
Birthday Form
 
Others things:

Customers with birthday should show in queue like a notification after team lead input the car so team lead can greet the customer. Also should get notification and text message

Customer should get a code for a free birthday premium wash. Validity of 7 days to use. Customer provide the code to admin to get the service for free. Birthday wash is free once a year only and birthdate can't be changed anymore.

Voucher board - where I can create voucher codes with settings for validity and # of use. For example, I can create a voucher code that is valid for 10 transactions only and should be connected with POS and deduct every time its used by customer.
[10/18/2026 10:11 PM] Sir michi: remove KPI - we will add to Floor Board
[10/18/2026 10:14 PM] Sir michi: Remove reviews - all are directed to google review and customer feedback form
[10/18/2026 10:21 PM] Sir michi: Move "Audit" in Operations Insight
[10/18/2026 10:28 PM] Sir michi: ADD Category: 

Configurations
- Move here "Branches"
- Move here "Services and Packages" List 
- Move here "Vehicle List" (option to add more new vehicle to our list)
- Move here "Detailing Packages" List 
- Move here "RBAC Delegation" 

Vouchers 
- Place where to generate codes for promo etc
[10/18/2026 10:35 PM] Sir michi: Category (New format / List) 

Floor Insight 
CarWash Queue
Detailing Schedule
Team Planner 
Point of Sales
Vouchers
Financials 
Human Resource
Customers 
Configuration

these are my notes cross-check and ensure it's complete 