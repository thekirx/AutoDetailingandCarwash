

QUEUE APP 
- Team lead accept the job on the floor and put details of the car ( Plate number, car model, services, assigned crew, status of the car, mobile number of the customer for automated notification via sms everytime status change) 
- Data should be perpetual so the next time the car goes back again it will be searched with the plate number or phone number of customer and it should be able to show history  of previous packages availed and time of visit (gives the team lead information what to upsell this time)
- Status of the car ( Waiting, In Progress, Final Inspection, For Payment)
-Team lead can return the job to previous crew as failed QA - that count should go to crew KPI 
-There should be a cancelled status too and list of reasons why customers cancelled the job
-For each status, it should indicate the average time it stays there except when completed. Waiting, In progress, Final Inspection, For Payment 
-There should be indication for cars FIFO (First in First Out) to tell crew which car is next 
- When job goes to for payment status it transfer to the POS so admin in the lounge can accept payment 	

DETAILING APP 
- Booking for Nano ceramic tint, Ceramic coating, Paint Protection film (PPF), Ceramic Paint Maintenance Package goes here since they have different process or stages than car wash services 
- Status of car when booked for these services (Placeholder, Transfer to Branch, Vehicle In-Take, Vehicle In-Progress, Final Inspection, Ready for Release, Completed) 
- When status goes to Ready for Release - it goes to POS so admin can accept payment 
- Completed status should have another category under it to define if it's Completed with no issues, Completed with complaints but addressed, Completed with customer not happy.
- Status 2 and 3 should automatically create a ticket for the team to investigate what happened and how the experience can be better
- Each change of status will automatically notify customer via sms and push notification of customer app if applicable 
- Is it possible to send pictures for updates on the app and customer get notified? (Better experience)
- Two ways of creating a booking, via online form and then manual ticket created on the detailing app 
-Visually for bookings on calendar it should be easy to distinct for what service and for which branch to help sales representative to make informed decision when to book a schedule 



POS APP
- Jobs from Queue APP that is for payment goes to POS. Admin will create user profile if the customer is new or will search for the phone number or name of customer to complete transaction. The new profile goes to customer app so they can login and see their profile there.
- Since from queue app it has already some of the details like car model, plate number, phone number, admin will just complete the details information of customer like the First name, last name and email address as optional 
- Admin wouldnt have rights to modify the jobs transfered from Queue app but they should have rights to add other sellable items like clothing, coffee, car scents, car accessorries and apply discount as necessary
-There should be options to categorize payments mode to Cash, gcash, or credit cards 
- If there is need to modify the job from queue app, they will have to ask the team lead to modify it from their end
-Only transaction created by admin on their end can they modify.
- Branch admin will only be allowed to add on inventory but Modify / delete requires elevated permission of General admin or Owner.
-In the POS app, admin will also generate a daily sales report everyday also where they will have option to indicate daily expenses incurred for hte day. This will then go to the Finance App for proper tagging of daily sales / expense report for the branch 
-Should send sms report to owner for daily sales report with the details Branch name, Total Sales (includes everything), Total Car wash sales, Total Detailing Sales, Total Nano Ceramic Tint Sales, Coffee Sales, Accessories Sales, Branch Salary Expenses, Break down of other expenses. Total of mode of payment (Cash, Gcash, Credit card)
- All sellable items is automatically deducted to inventory 
- All transactions by branch admin should be audited and logged 

INVENTORY APP
- Only general admin or owner can modify current inventory count per branch To avoid anyone from updating the inventory to hide loss or non remittance.
- Branch admin can add restock count as it arrives to update the inventory app per branch 
- ResellAble items are automatically tally on the app, (Current inventory - what is sold from POS.)
- Internal use inventory (should be reconciled and updated manually every Sunday by the branch admin) This process will tell how much of hte inventory was used for the week. Branch admin will put up the report of how much of the items are left and it goes to Branch admin or owner for review/approval (process to catch if items are missing) When approved, it update the current inventory count for the items. This data is important to build up how much are being consumed per branch)



FINANCE APP 
- all sales report from all branches will converge here. Including the expenses submitted by the admin 
- Salary will also converge here 
- there will be options to create categories on the expenses that will show up on the POS app when admin are submitting for expenses 
- There should be reporting for P&L including all categories and different timeline. 
- General admin can go here and manually add expenses as required from other monthly expenses. 
-Salary from the salary App will also converge here as an expense 
-Should have delegation to view p&L for specific branch only (specific for investor) 
- Should be able to create Vendor list in the app to maintain supplier records 
- Should have way to send qoutation to customer via email 
- Finance reporting per branch or performance across all branches ( Profit, comparison to previous year, net pay, growth or loss percentage, etc)
-Should have executive summary dashboard to show how the business overall is performing and way to filter per branch
-Should have a Corporate Account separate from the branches where all money goes to every end of the month. This basically shows how much is the total money left should be for the  business. Also this is the account where general expenses will go to 

SALARY APP 
- Admin per branch will generate salary per day pulling report from the POS App of daily sales - with equivalent percentage rate per service (set somewhere) 
- Admin should be able to modify the report as needed before pushing it 
- Admin should be able to add additional salary or deductions on the report 
- Admin should be able to add cash advance for monitoring if the employee filed for cash advance (Not part of sales for P&L in finance app)
- Admin should be able to add cash advance payment for monitoring if the employee filed for their cash advance (Not part of sales for P&L in finance app)

EMPLOYEE APP
- All employee will have their own access where they will see their salary for the day 
- Time in and out button within proximity of Hakum Branch
- They should see the jobs assigned ot them and the details to that job 
- will have report button so they can generate how much they earned for a period of time (daily, weekly, monthly, annually or customize date) 
- They will see their cash advances 
- They will see their cash advance payments 
- They should see the average time of their services 
- They should see how many jobs assigned to them has failed Quality assurance 
- Button to request for cash advances - goes to general admin for approval 

CUSTOMER APP 
- Customer will see how many loyalty stars they already have to get the FREE 
- They see the car assigned to their name
- Button for them to create or add cars to their phone number or account 
- Customers should be able to customize their cars maybe add Icon or picture on their profile
- They will see the current live queue app for Hakum branches near to them as default but also see for others
- they will see weather forecast maybe to help them decide if they want to go for carwash. Like percentage of rain in the branch they are close to? (If possible but optional to add) 
- They will see the blogs and events from Hakum Website 
- They will get push notifications from marketing and notifications too for when their car change status in car wash 

FLOOR BOARD APP
- App meant for the owner to have view access to all branches performance 
- KPI , reporting features like for car size per sale, best performing package or service, etc (to be defined)
- Chemical usage (those that needs to be check out) across all branch but can filter per branch including chemical cost use. Also a graph of how much each branch inventory cost use
- Financial reporting should also show here

SETTINGS BUTTON:
- (Queue app / Employee app) Create accounts for branch level employee and assign their roles in the branch (Crew, admin or team lead). Also an option to delete the profile once they are no longer connected to the company 
-(Queue app / Employee app) there should be a way to temporary assign a Team lead role to a crew in the event team lead is not available on site that day. 
-(Queue app / Employee /POS app) Create services list, add potential duration time, Service cost percentage (for salary), SLA (for the specific service - can be used as average time baseline for each services. If it goes over SLA then it should be red in reporting etc) Also services is general across all branches 
-(Detailing app) Create package list, Service Cost percentage (for salary - this can be null too for those services that doesnt have fix service cost)
-(POS APP) Should be able to create sellable items, Clothing, or car accessories and other items being sold in Hakum 
-(Inventory APP)  Should be able to create all inventory used in Hakum operations (Chemicals, equipments, usable items, size or quantity count, Price per item) 
-(Inventory APP) Should be able to tag items if it's resellable or internal use. Resellable shows to POS and track on inventory app. Internal use is track on Inventory APP only
-(Finance APP) Create expense categories, Create Supplier contact information, Create new Branch Locations, Create new customer information for qoutations (expense categories goes to all other app so it match) 
-(Customer APP) create new accounts for customer or change status to disable or dont receive notifications etc. 









